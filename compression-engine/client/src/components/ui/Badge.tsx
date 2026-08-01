import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]',
  primary: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  error: 'bg-red-500/10 text-red-400',
  info: 'bg-blue-500/10 text-blue-400',
};

export function Badge({ variant = 'default', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
      {...rest}
    />
  );
}
