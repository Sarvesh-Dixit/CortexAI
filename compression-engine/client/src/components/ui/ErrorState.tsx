import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We ran into an error. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="glass-card p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mx-auto mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" leftIcon={<RefreshCcw className="w-3.5 h-3.5" />} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
