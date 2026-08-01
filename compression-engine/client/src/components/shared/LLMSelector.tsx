import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Clock, DollarSign, Check } from 'lucide-react';
import { LLM_PROVIDERS, getProvider, formatContextWindow } from '../../lib/providers';
import { useClickOutside, useEscapeKey } from '../../hooks';
import { formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface LLMSelectorProps {
  value: string;
  onChange: (id: string) => void;
  tokens?: number;
}

const speedColors = {
  fast: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  slow: 'text-blue-400 bg-blue-500/10',
};

export function LLMSelector({ value, onChange, tokens }: LLMSelectorProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const current = getProvider(value) || LLM_PROVIDERS[0];

  // Close when clicking outside the dropdown (but not the trigger)
  useClickOutside(dropdownRef, () => {
    if (open) setOpen(false);
  });
  useEscapeKey(() => open && setOpen(false));

  // Recalculate position when opening or on resize/scroll
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  // Close dropdown when the trigger scrolls out of view significantly
  useEffect(() => {
    if (!open) setPosition(null);
  }, [open]);

  const currentCost = tokens ? (tokens / 1000) * current.costPer1kTokens : 0;

  return (
    <div ref={triggerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 hover:border-[hsl(var(--primary))]/30 transition-all"
      >
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium truncate">{current.name}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{current.model}</p>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform flex-shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Info row */}
      <div className="grid grid-cols-3 gap-1.5 mt-2 text-[10px]">
        <div className="flex items-center gap-1 px-2 py-1 bg-[hsl(var(--secondary))] rounded-lg">
          <Zap className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[hsl(var(--muted-foreground))]">Context:</span>
          <span className="font-medium">{formatContextWindow(current.contextWindow)}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-[hsl(var(--secondary))] rounded-lg">
          <Clock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
          <span className={cn('capitalize font-medium', speedColors[current.speedRating].split(' ')[0])}>
            {current.speedRating}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-[hsl(var(--secondary))] rounded-lg">
          <DollarSign className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
          <span className="font-medium">
            {tokens ? formatCurrency(currentCost) : `$${current.costPer1kTokens}/1K`}
          </span>
        </div>
      </div>

      {/* Dropdown rendered in a portal to escape any parent stacking context */}
      {open && position && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 100,
            }}
            className="glass-card p-1 max-h-80 overflow-y-auto shadow-2xl shadow-black/40"
          >
            {LLM_PROVIDERS.map((p) => {
              const isActive = p.id === value;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                    isActive
                      ? 'bg-[hsl(var(--primary))]/10'
                      : 'hover:bg-[hsl(var(--secondary))]'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', speedColors[p.speedRating])}>
                        {p.speedRating}
                      </span>
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      {p.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <span>{formatContextWindow(p.contextWindow)} context</span>
                      <span>•</span>
                      <span>${p.costPer1kTokens}/1K tokens</span>
                    </div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
