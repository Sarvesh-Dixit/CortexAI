import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className, ...rest }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full appearance-none bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-all',
              className
            )}
            {...rest}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
