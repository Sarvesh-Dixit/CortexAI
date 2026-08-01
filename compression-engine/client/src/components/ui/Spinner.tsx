import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin',
        sizeMap[size],
        className
      )}
    />
  );
}

export function CenteredSpinner({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size={size} />
    </div>
  );
}
