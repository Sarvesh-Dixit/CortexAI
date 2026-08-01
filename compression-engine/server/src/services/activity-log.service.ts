/**
 * Activity Log Service.
 * 
 * Records user actions for audit trail, security, and analytics.
 * Non-blocking: logs are written asynchronously and never block the request.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { v4 as uuid } from 'uuid';

export type ActivityAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_changed'
  | 'auth.password_reset'
  | 'document.uploaded'
  | 'document.deleted'
  | 'document.previewed'
  | 'compression.created'
  | 'compression.deleted'
  | 'settings.updated'
  | 'apikey.added'
  | 'apikey.deleted'
  | 'apikey.toggled'
  | 'llm.tested';

export interface LogEntry {
  userId: string;
  action: ActivityAction;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class ActivityLogService {
  /**
   * Log a user activity. Fire-and-forget: never throws.
   */
  static async log(entry: LogEntry): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          id: uuid(),
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      logger.error(`Failed to log activity: ${(error as Error).message}`);
      // Never throw - activity logging must not break the request
    }
  }

  /**
   * Get recent activity for a user.
   */
  static async getForUser(userId: string, limit = 50) {
    return prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
