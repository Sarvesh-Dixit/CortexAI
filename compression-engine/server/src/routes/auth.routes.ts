import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ActivityLogService } from '../services/activity-log.service';
import { isRoleValid } from '../middleware/rbac';
import { sha256 } from '../utils/crypto';
import { v4 as uuid } from 'uuid';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'developer', 'researcher', 'guest']).optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

/**
 * Persist a session — we store SHA-256 hashes of the tokens, never the raw JWT.
 * That way, if the DB is compromised, an attacker can't replay tokens.
 */
async function persistSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
  req: Request
): Promise<void> {
  await prisma.session.create({
    data: {
      id: uuid(),
      userId,
      tokenHash: sha256(accessToken),
      refreshHash: sha256(refreshToken),
      ipAddress: req.ip?.slice(0, 45),
      userAgent: (req.headers['user-agent'] || '').slice(0, 500),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Default to 'developer'. Admin role is never self-assigned — must be set manually via DB.
    const requestedRole = data.role && data.role !== 'admin' ? data.role : 'developer';
    const role = isRoleValid(requestedRole) ? requestedRole : 'developer';

    const user = await prisma.user.create({
      data: {
        id: uuid(),
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: role as any,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    ActivityLogService.log({
      userId: user.id,
      action: 'auth.register',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await persistSession(user.id, accessToken, refreshToken, req);

    res.status(201).json({
      success: true,
      data: { user, accessToken, refreshToken },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new AppError('Invalid credentials', 401);

    // Account lockout after too many failures
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is temporarily locked. Try again later.', 429);
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      // Increment failed attempts and lock after 5
      const failedCount = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil: failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) throw new AppError('Account is disabled', 403);

    // Success — reset counters, record last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip?.slice(0, 45),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await persistSession(user.id, accessToken, refreshToken, req);

    ActivityLogService.log({
      userId: user.id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(error.errors[0].message, 400));
    } else {
      next(error);
    }
  }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const session = await prisma.session.findFirst({
      where: {
        refreshHash: sha256(refreshToken),
        userId: decoded.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) throw new AppError('Invalid or expired refresh token', 401);

    const tokens = generateTokens(decoded.userId);

    // Rotate — revoke the old, create a new session
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.session.create({
        data: {
          id: uuid(),
          userId: decoded.userId,
          tokenHash: sha256(tokens.accessToken),
          refreshHash: sha256(tokens.refreshToken),
          ipAddress: req.ip?.slice(0, 45),
          userAgent: (req.headers['user-agent'] || '').slice(0, 500),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid refresh token', 401));
  }
});

authRouter.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      await prisma.session.updateMany({
        where: { tokenHash: sha256(token) },
        data: { revokedAt: new Date() },
      });
    }

    if (req.userId) {
      ActivityLogService.log({
        userId: req.userId,
        action: 'auth.logout',
        resource: 'user',
        resourceId: req.userId,
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, name: true, avatar: true, role: true,
        theme: true, language: true, preferredLlm: true, defaultCompression: true,
        isActive: true, emailVerified: true, lastLoginAt: true, createdAt: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, name: true, avatar: true, role: true,
        theme: true, language: true, preferredLlm: true, defaultCompression: true,
        isActive: true, emailVerified: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.put('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(avatar !== undefined && { avatar }),
      },
      select: { id: true, email: true, name: true, avatar: true, role: true },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.put('/change-password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new AppError('Current and new password required', 400);
    }
    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 12);

    // Invalidate ALL other sessions when password changes (security best practice)
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { password: hashed } }),
      prisma.session.updateMany({
        where: { userId: req.userId!, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    ActivityLogService.log({
      userId: req.userId!,
      action: 'auth.password_changed',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email required', 400);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return the same response so we don't leak which emails exist
    if (!user) {
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    const resetToken = jwt.sign({ userId: user.id, type: 'reset' }, process.env.JWT_SECRET!, { expiresIn: '1h' });

    // Store only the HASH — the raw token goes to the user via email
    await prisma.passwordReset.create({
      data: {
        id: uuid(),
        userId: user.id,
        tokenHash: sha256(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // In production, send `resetToken` via email. For dev, return it.
    const isProd = process.env.NODE_ENV === 'production';
    res.json({
      success: true,
      message: 'Reset link sent to email',
      ...(isProd ? {} : { resetToken }),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw new AppError('Token and new password required', 400);
    if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; type: string };
    if (decoded.type !== 'reset') throw new AppError('Invalid reset token', 400);

    // Verify the token was issued by us (present in password_resets and unused)
    const reset = await prisma.passwordReset.findFirst({
      where: {
        tokenHash: sha256(token),
        userId: decoded.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!reset) throw new AppError('Invalid or expired reset token', 400);

    const hashed = await bcrypt.hash(newPassword, 12);

    // Update password, mark reset as used, revoke all sessions
    await prisma.$transaction([
      prisma.user.update({ where: { id: decoded.userId }, data: { password: hashed } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({
        where: { userId: decoded.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    ActivityLogService.log({
      userId: decoded.userId,
      action: 'auth.password_reset',
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired reset token', 400));
  }
});
