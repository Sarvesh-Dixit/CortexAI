import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: { value: number; positive: boolean };
  delay?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-violet-400',
  trend,
  delay = 0,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('stat-card', className)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {trend && (
            <p
              className={cn(
                'text-xs mt-1',
                trend.positive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {trend.positive ? '+' : ''}
              {trend.value}% vs last period
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl bg-[hsl(var(--secondary))] flex items-center justify-center flex-shrink-0',
              iconColor
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
