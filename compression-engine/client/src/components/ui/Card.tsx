import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable, padding = 'md', className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass-card',
          paddingMap[padding],
          hoverable && 'hover:border-[hsl(var(--primary))]/30 transition-all',
          className
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn('mb-3', className)} {...rest} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...rest }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-semibold', className)} {...rest} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...rest }, ref) => (
    <p ref={ref} className={cn('text-xs text-[hsl(var(--muted-foreground))]', className)} {...rest} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => <div ref={ref} className={className} {...rest} />
);
CardContent.displayName = 'CardContent';
