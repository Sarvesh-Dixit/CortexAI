import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (v: string) => void;
  onClear?: () => void;
}

export function SearchBar({ value, onChange, onClear, className, placeholder = 'Search...', ...rest }: SearchBarProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange?.('');
            onClear?.();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
