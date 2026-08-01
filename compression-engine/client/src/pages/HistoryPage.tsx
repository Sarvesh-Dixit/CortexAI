import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Trash2, Download, Copy, Minimize2 } from 'lucide-react';
import { CompressionService } from '../services';
import { useCompressionStore } from '../store';
import { formatPercentage, formatCurrency, formatDateTime, truncate } from '../lib/utils';
import { useDebounce } from '../hooks';
import { PageHeader, SearchBar, FilterBar, Pagination } from '../components/shared';
import { Badge, ConfirmDialog, CenteredSpinner, EmptyState } from '../components/ui';
import type { CompressionRecord } from '../types';

export default function HistoryPage() {
  const navigate = useNavigate();
  const { setText } = useCompressionStore();

  const [records, setRecords] = useState<CompressionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [documentType, setDocumentType] = useState('');
  const [sortBy, setSortBy] = useState('createdAt-desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompressionRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [page, debouncedSearch, documentType, sortBy]);

  const loadHistory = async () => {
    try {
      const [field, order] = sortBy.split('-') as [string, 'asc' | 'desc'];
      const res = await CompressionService.getHistory({
        page, limit: 10, search: debouncedSearch, documentType,
        sortBy: field, order,
      });
      setRecords(res.compressions);
      setTotalPages(res.pagination.pages);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await CompressionService.deleteHistoryItem(confirmDelete.id);
      setRecords(records.filter((r) => r.id !== confirmDelete.id));
      toast.success('Record deleted');
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = (record: CompressionRecord) => {
    setText(record.originalText);
    navigate('/compress');
    toast.success('Loaded to compress page');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleDownload = (record: CompressionRecord) => {
    const blob = new Blob([record.compressedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed-${record.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && records.length === 0) return <CenteredSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compression History"
        description="View and manage your past compressions"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search compressions..."
          className="sm:max-w-md"
        />
        <FilterBar
          filters={[
            {
              key: 'type',
              label: 'Types',
              options: [
                { value: 'text', label: 'Text' },
                { value: 'code', label: 'Code' },
                { value: 'json', label: 'JSON' },
                { value: 'markdown', label: 'Markdown' },
                { value: 'logs', label: 'Logs' },
                { value: 'email', label: 'Email' },
                { value: 'legal_document', label: 'Legal' },
                { value: 'technical_documentation', label: 'Technical Docs' },
              ],
              value: documentType,
              onChange: (v) => { setDocumentType(v); setPage(1); },
            },
            {
              key: 'sort',
              label: 'Sort',
              options: [
                { value: 'createdAt-desc', label: 'Newest first' },
                { value: 'createdAt-asc', label: 'Oldest first' },
                { value: 'compressionRatio-desc', label: 'Best compression' },
                { value: 'costSavings-desc', label: 'Most savings' },
              ],
              value: sortBy,
              onChange: setSortBy,
            },
          ]}
          onClearAll={() => {
            setDocumentType('');
            setSortBy('createdAt-desc');
            setSearch('');
          }}
        />
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No compressions found"
          description="Try adjusting your filters, or compress a new prompt to get started."
        />
      ) : (
        <div className="space-y-3">
          {records.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="glass-card p-4 hover:border-[hsl(var(--primary))]/30 transition-all cursor-pointer"
              onClick={() => setSelectedId(selectedId === record.id ? null : record.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="primary" className="capitalize">{record.documentType}</Badge>
                    <Badge variant="default" className="capitalize">{record.compressionLevel}</Badge>
                    <Badge variant="default" className="capitalize">{record.llmProvider}</Badge>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatDateTime(record.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                    {truncate(record.originalText, 100)}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-emerald-400">{formatPercentage(record.compressionRatio)}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">saved {formatCurrency(record.costSavings)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(record.compressedText); }}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Copy compressed"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(record); }}
                      className="p-1.5 hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors"
                      title="Duplicate to compress"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(record); }}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(record); }}
                      className="p-1.5 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {selectedId === record.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-[hsl(var(--border))] grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1">
                      Original ({record.originalTokens} tokens)
                    </p>
                    <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-32 overflow-auto whitespace-pre-wrap">
                      {record.originalText}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-emerald-400 mb-1">
                      Compressed ({record.compressedTokens} tokens)
                    </p>
                    <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-32 overflow-auto whitespace-pre-wrap">
                      {record.compressedText}
                    </pre>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete compression?"
        description="This record will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
