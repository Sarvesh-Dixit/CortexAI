import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ComparisonCardProps {
  leftLabel: string;
  leftValue: string | number;
  leftSubtext?: string;
  rightLabel: string;
  rightValue: string | number;
  rightSubtext?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  improvement?: string;
  improvementPositive?: boolean;
  delay?: number;
  className?: string;
}

export function ComparisonCard({
  leftLabel,
  leftValue,
  leftSubtext,
  rightLabel,
  rightValue,
  rightSubtext,
  leftIcon,
  rightIcon,
  improvement,
  improvementPositive = true,
  delay = 0,
  className,
}: ComparisonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn('glass-card p-4', className)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {leftIcon}
            <span className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              {leftLabel}
            </span>
          </div>
          <p className="text-xl font-bold truncate">{leftValue}</p>
          {leftSubtext && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{leftSubtext}</p>
          )}
        </div>

        <div className="flex flex-col items-center flex-shrink-0 px-3">
          <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] hidden sm:block" />
          <ArrowDown className="w-4 h-4 text-[hsl(var(--muted-foreground))] sm:hidden" />
          {improvement && (
            <span
              className={cn(
                'text-[10px] mt-1 font-medium',
                improvementPositive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {improvement}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              {rightLabel}
            </span>
            {rightIcon}
          </div>
          <p className="text-xl font-bold text-emerald-400 truncate">{rightValue}</p>
          {rightSubtext && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{rightSubtext}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
