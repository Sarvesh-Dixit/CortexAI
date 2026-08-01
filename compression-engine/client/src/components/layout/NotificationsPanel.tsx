import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2, Check, X, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useNotificationStore } from '../../store';
import type { NotificationItem } from '../../types';
import { cn } from '../../lib/utils';

interface NotificationsPanelProps {
  onClose: () => void;
}

const iconMap = {
  success: { icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function NotificationRow({ item, onRemove, onMarkRead }: {
  item: NotificationItem;
  onRemove: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const config = iconMap[item.type];
  const Icon = config.icon;

  return (
    <div
      onClick={() => !item.read && onMarkRead(item.id)}
      className={cn(
        'group p-3 border-b border-[hsl(var(--border))] last:border-0 transition-colors cursor-pointer',
        !item.read && 'bg-[hsl(var(--primary))]/5 hover:bg-[hsl(var(--primary))]/10',
        item.read && 'hover:bg-[hsl(var(--secondary))]/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.title}</p>
          {item.message && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
              {item.message}
            </p>
          )}
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
            {formatTime(item.timestamp)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const { items, markAllRead, remove, markRead, clearAll } = useNotificationStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-80 glass-card overflow-hidden z-40"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <>
              <button
                onClick={markAllRead}
                className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              </button>
              <button
                onClick={clearAll}
                className="p-1.5 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-[hsl(var(--muted-foreground))] mx-auto mb-2 opacity-50" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No notifications yet</p>
          </div>
        ) : (
          items.map((item) => (
            <NotificationRow key={item.id} item={item} onRemove={remove} onMarkRead={markRead} />
          ))
        )}
      </div>
    </motion.div>
  );
}
