import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
  icon?: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpen?: string[];
}

export function Accordion({ items, allowMultiple = false, defaultOpen = [] }: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpen));

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div key={item.id} className="glass-card overflow-hidden">
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[hsl(var(--secondary))]/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 border-t border-[hsl(var(--border))] text-sm">
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
