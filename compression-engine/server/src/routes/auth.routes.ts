import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ActivityLogService } from '../services/activity-log.service';
import { isRoleValid } from '../middleware/rbac';
import { v4 as uuid } from 'uuid';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(['admin', 'developer', 'researcher', 'guest']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Role validation: default to 'developer', admin can only be set manually via DB
    const requestedRole = data.role && data.role !== 'admin' ? data.role : 'developer';
    const role = isRoleValid(requestedRole) ? requestedRole : 'developer';

    const user = await prisma.user.create({
      data: {
        id: uuid(),
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role,
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

    await prisma.session.create({
      data: {
        id: uuid(),
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

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
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is disabled', 403);
    }

    // Update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);

    ActivityLogService.log({
      userId: user.id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await prisma.session.create({
      data: {
        id: uuid(),
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
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
      where: { refreshToken, userId: decoded.userId },
    });

    if (!session) throw new AppError('Invalid refresh token', 401);

    const tokens = generateTokens(decoded.userId);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid refresh token', 401));
  }
});

authRouter.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.slice(7);
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
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
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        theme: true,
        language: true,
        preferredLlm: true,
        defaultCompression: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/profile - alias for /me (spec-compliant naming)
 */
authRouter.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, name: true, avatar: true, role: true,
        theme: true, language: true, preferredLlm: true, defaultCompression: true,
        isActive: true, lastLogin: true, createdAt: true,
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
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email required', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // In production, send email with reset link
      // For now, generate a reset token
      const resetToken = jwt.sign({ userId: user.id, type: 'reset' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
      // Store or send token - simplified for demo
      res.json({ success: true, message: 'Reset link sent to email', resetToken });
    } else {
      // Don't reveal if email exists
      res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }
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

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: decoded.userId }, data: { password: hashed } });

    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { userId: decoded.userId } });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Invalid or expired reset token', 400));
  }
});
