import type { ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onClearAll?: () => void;
  extra?: ReactNode;
}

export function FilterBar({ filters, onClearAll, extra }: FilterBarProps) {
  const hasActiveFilters = filters.some((f) => f.value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Filter className="w-3.5 h-3.5" />
        <span>Filters:</span>
      </div>

      {filters.map((filter) => (
        <div key={filter.key} className="relative">
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className={cn(
              'appearance-none pl-3 pr-8 py-1.5 text-xs rounded-lg border transition-all cursor-pointer',
              filter.value
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]/30'
            )}
          >
            <option value="">All {filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {opt.count !== undefined && ` (${opt.count})`}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hasActiveFilters && onClearAll && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}

      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}
