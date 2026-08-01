import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEscapeKey } from '../../hooks';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]',
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  side = 'right',
  size = 'md',
}: DrawerProps) {
  useEscapeKey(() => open && onClose());

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  const xValue = side === 'right' ? '100%' : '-100%';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: xValue }}
            animate={{ x: 0 }}
            exit={{ x: xValue }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'absolute inset-y-0 bg-[hsl(var(--card))] border-[hsl(var(--border))] flex flex-col',
              sizeMap[size],
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              'max-w-full'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || true) && (
              <div className="flex items-start justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div>
                  {title && <h3 className="text-base font-semibold">{title}</h3>}
                  {description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
