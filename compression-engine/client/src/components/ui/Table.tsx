import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...rest} />
    </div>
  );
}

export function TableHeader({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        'border-b border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider',
        className
      )}
      {...rest}
    />
  );
}

export function TableBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...rest} />;
}

export function TableRow({
  className,
  hoverable = true,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean }) {
  return (
    <tr
      className={cn(
        'border-b border-[hsl(var(--border))]/50 last:border-0',
        hoverable && 'hover:bg-[hsl(var(--secondary))]/30 transition-colors',
        className
      )}
      {...rest}
    />
  );
}

export function TableHead({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-3 py-2.5 text-left font-medium', className)} {...rest} />;
}

export function TableCell({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-3', className)} {...rest} />;
}

interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow hoverable={false}>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center',
                col.className
              )}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow
            key={keyExtractor(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(onRowClick && 'cursor-pointer')}
          >
            {columns.map((col) => (
              <TableCell
                key={col.key}
                className={cn(
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className
                )}
              >
                {col.render ? col.render(row) : (row as any)[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
