import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, containerClassName, className, ...rest }, ref) => {
    return (
      <div className={cn('w-full', containerClassName)}>
        {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full py-2.5 bg-[hsl(var(--input))] border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all',
              leftIcon ? 'pl-10' : 'pl-4',
              rightIcon ? 'pr-10' : 'pr-4',
              error ? 'border-red-500/50' : 'border-[hsl(var(--border))]',
              className
            )}
            {...rest}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
