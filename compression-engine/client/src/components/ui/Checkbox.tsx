import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  containerClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, containerClassName, className, checked, ...rest }, ref) => {
    return (
      <label className={cn('inline-flex items-center gap-2 cursor-pointer group', containerClassName)}>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="peer sr-only"
            {...rest}
          />
          <div
            className={cn(
              'w-4 h-4 rounded border-2 transition-all flex items-center justify-center',
              checked
                ? 'bg-[hsl(var(--primary))] border-[hsl(var(--primary))]'
                : 'border-[hsl(var(--border))] group-hover:border-[hsl(var(--primary))]/50',
              className
            )}
          >
            {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
          </div>
        </div>
        {label && <span className="text-sm">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
