import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {start > 1 && (
        <>
          <button
            onClick={() => onChange(1)}
            className="min-w-[36px] h-9 px-2 text-sm rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            1
          </button>
          {start > 2 && <span className="text-[hsl(var(--muted-foreground))] px-1">...</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'min-w-[36px] h-9 px-2 text-sm rounded-lg transition-colors',
            p === page
              ? 'bg-[hsl(var(--primary))] text-white'
              : 'hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
          )}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-[hsl(var(--muted-foreground))] px-1">...</span>}
          <button
            onClick={() => onChange(totalPages)}
            className="min-w-[36px] h-9 px-2 text-sm rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        className="p-2 rounded-lg hover:bg-[hsl(var(--secondary))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
