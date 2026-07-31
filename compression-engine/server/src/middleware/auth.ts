import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';
import { sha256 } from '../utils/crypto';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) throw new AppError('Authentication required', 401);

    // 1) Verify the JWT signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    // 2) Confirm the session still exists and is not revoked
    //    (allows admin-triggered mass logout by revoking all sessions)
    const session = await prisma.session.findFirst({
      where: {
        tokenHash: sha256(token),
        userId: decoded.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new AppError('Session revoked or expired', 401);

    // 3) Load the user (also verifies the account still exists and is active)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!user) throw new AppError('User not found', 401);
    if (!user.isActive) throw new AppError('Account is disabled', 403);

    req.userId = user.id;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid token', 401));
    }
  }
}
