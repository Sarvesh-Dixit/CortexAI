import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
  height?: string;
}

export function ChartCard({
  title,
  description,
  actions,
  children,
  delay = 0,
  className,
  height = 'h-64',
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('glass-card p-6', className)}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div className={height}>{children}</div>
    </motion.div>
  );
}
