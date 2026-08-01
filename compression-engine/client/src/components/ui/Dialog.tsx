import type { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

type DialogVariant = 'info' | 'warning' | 'danger' | 'success';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
  loading?: boolean;
  children?: ReactNode;
}

const iconMap = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  danger: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  loading,
  children,
}: ConfirmDialogProps) {
  const { icon: Icon, color, bg } = iconMap[variant];

  return (
    <Modal open={open} onClose={onClose} size="sm" showClose={false}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="mb-4">{children}</div>}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'gradient'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
