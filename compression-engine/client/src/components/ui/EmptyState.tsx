import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-[hsl(var(--muted-foreground))]" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-md mx-auto mb-4">
          {description}
        </p>
      )}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
