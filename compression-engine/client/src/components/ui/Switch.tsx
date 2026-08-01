import { cn } from '../../lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex flex-shrink-0 mt-0.5 h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'inline-block w-3.5 h-3.5 rounded-full bg-white transition-transform',
            'absolute top-1/2 -translate-y-1/2',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && <p className="text-sm font-medium">{label}</p>}
          {description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
