import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEscapeKey } from '../../hooks';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', showClose = true }: ModalProps) {
  useEscapeKey(() => open && onClose());

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={cn('glass-card p-6 w-full max-h-[90vh] overflow-auto', sizeMap[size])}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between mb-4">
                <div>
                  {title && <h2 className="text-lg font-semibold">{title}</h2>}
                  {description && <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{description}</p>}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="p-1 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors text-[hsl(var(--muted-foreground))]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
