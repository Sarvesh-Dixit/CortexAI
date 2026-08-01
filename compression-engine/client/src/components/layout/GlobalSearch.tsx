import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, History, Minimize2, BarChart3, Code2, Settings as SettingsIcon, X, ScanText } from 'lucide-react';
import { useDebounce, useEscapeKey } from '../../hooks';
import { CompressionService, DocumentService } from '../../services';
import type { CompressionRecord, DocumentRecord } from '../../types';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  type: 'history' | 'document' | 'page';
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  icon: typeof Search;
}

const QUICK_LINKS: SearchResult[] = [
  { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'View metrics and activity', path: '/dashboard', icon: BarChart3 },
  { type: 'page', id: 'compress', title: 'Compress Prompt', subtitle: 'Reduce token usage', path: '/compress', icon: Minimize2 },
  { type: 'page', id: 'analysis', title: 'Prompt Analysis', subtitle: 'Analyze without compressing', path: '/analysis', icon: FileText },
  { type: 'page', id: 'ocr', title: 'Image to Text', subtitle: 'Extract text from screenshots (OCR)', path: '/ocr', icon: ScanText },
  { type: 'page', id: 'history', title: 'History', subtitle: 'Past compressions', path: '/history', icon: History },
  { type: 'page', id: 'documents', title: 'Documents', subtitle: 'Uploaded files', path: '/documents', icon: FileText },
  { type: 'page', id: 'playground', title: 'API Playground', subtitle: 'Test with providers', path: '/playground', icon: Code2 },
  { type: 'page', id: 'settings', title: 'Settings', subtitle: 'Preferences and API keys', path: '/settings', icon: SettingsIcon },
];

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [history, setHistory] = useState<CompressionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEscapeKey(() => open && onClose());

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setHistory([]);
      setDocuments([]);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const [historyRes, docsRes] = await Promise.all([
          CompressionService.getHistory({ search: debouncedQuery, limit: 5 }).catch(() => ({ compressions: [] as CompressionRecord[] })),
          DocumentService.list().catch(() => [] as DocumentRecord[]),
        ]);
        setHistory(historyRes.compressions);
        setDocuments(
          docsRes.filter((d) =>
            d.originalName.toLowerCase().includes(debouncedQuery.toLowerCase())
          ).slice(0, 5)
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedQuery, open]);

  const filteredPages = useMemo(() => {
    if (!query) return QUICK_LINKS;
    const q = query.toLowerCase();
    return QUICK_LINKS.filter(
      (l) => l.title.toLowerCase().includes(q) || l.subtitle?.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm pt-[10vh] px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="max-w-xl mx-auto glass-card overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
              <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search history, documents, prompts..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {filteredPages.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Pages
                  </p>
                  {filteredPages.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => handleSelect(link.path)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                    >
                      <link.icon className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{link.title}</p>
                        {link.subtitle && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{link.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {history.length > 0 && (
                <div className="p-2 border-t border-[hsl(var(--border))]">
                  <p className="px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Compression History
                  </p>
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleSelect(`/history`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                    >
                      <History className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {h.originalText.slice(0, 60)}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {h.documentType} • {(h.compressionRatio * 100).toFixed(0)}% compressed
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {documents.length > 0 && (
                <div className="p-2 border-t border-[hsl(var(--border))]">
                  <p className="px-3 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Documents
                  </p>
                  {documents.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelect(`/documents`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[hsl(var(--secondary))] transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.originalName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {d.documentType} • {(d.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading &&
                query.length >= 2 &&
                filteredPages.length === 0 &&
                history.length === 0 &&
                documents.length === 0 && (
                  <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No results found for "{query}"
                  </div>
                )}
            </div>

            <div className="px-4 py-2 border-t border-[hsl(var(--border))] flex items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[hsl(var(--secondary))] rounded">Esc</kbd>
                to close
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[hsl(var(--secondary))] rounded">↵</kbd>
                to select
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
