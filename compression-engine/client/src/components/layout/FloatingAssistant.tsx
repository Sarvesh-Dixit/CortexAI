import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight, Zap, Minimize2, FileSearch, BarChart3, ScanText } from 'lucide-react';
import { useClickOutside } from '../../hooks';

const SUGGESTIONS = [
  {
    icon: Minimize2,
    title: 'Compress a prompt',
    description: 'Reduce token usage while preserving meaning',
    path: '/compress',
  },
  {
    icon: ScanText,
    title: 'Extract text from image',
    description: 'Save 90% on vision tokens with OCR',
    path: '/ocr',
  },
  {
    icon: FileSearch,
    title: 'Analyze text',
    description: 'Get insights on document type, cost, and structure',
    path: '/analysis',
  },
  {
    icon: BarChart3,
    title: 'View analytics',
    description: 'See compression trends and savings',
    path: '/analytics',
  },
];

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 right-0 w-80 glass-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg gradient-button flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Assistant</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    How can I help?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2">
              <p className="px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Quick Actions
              </p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.path}
                  onClick={() => {
                    navigate(s.path);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] flex-shrink-0">
                    <s.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {s.description}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors" />
                </button>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30">
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Zap className="w-3 h-3 text-[hsl(var(--primary))]" />
                <span>Powered by multi-agent AI pipeline</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="w-13 h-13 rounded-full gradient-button flex items-center justify-center shadow-xl shadow-[hsl(var(--primary))]/20"
        style={{ width: 52, height: 52 }}
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Sparkles className="w-5 h-5 text-white" />
        )}
      </motion.button>
    </div>
  );
}
