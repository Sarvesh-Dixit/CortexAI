import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  FileText, Trash2, Eye, File as FileIcon, Code, Database,
  Grid3x3, List, Minimize2, Download, Sparkles,
} from 'lucide-react';
import { DocumentService, CompressionService } from '../services';
import { useCompressionStore, useAuthStore } from '../store';
import type { CompressionLevel, CompressionResult } from '../types';
import { formatNumber, formatDate } from '../lib/utils';
import { PageHeader, FileUpload, SearchBar, FilterBar } from '../components/shared';
import { Button, Modal, ConfirmDialog, EmptyState, CenteredSpinner, Badge, DataTable, Select } from '../components/ui';
import type { DocumentRecord } from '../types';

const typeIcons: Record<string, typeof FileText> = {
  text: FileText,
  python: Code,
  javascript: Code,
  typescript: Code,
  java: Code,
  cpp: Code,
  json: Database,
  markdown: FileText,
  csv: Database,
  pdf: FileIcon,
  docx: FileIcon,
  logs: FileText,
  code: Code,
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt-desc');
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick compress state
  const [quickCompressDoc, setQuickCompressDoc] = useState<DocumentRecord | null>(null);
  const [quickLevel, setQuickLevel] = useState<CompressionLevel>('medium');
  const [quickResult, setQuickResult] = useState<CompressionResult | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);

  const navigate = useNavigate();
  const { setText } = useCompressionStore();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await DocumentService.list();
      setDocuments(docs);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await DocumentService.upload(file);
        toast.success(`"${file.name}" uploaded`);
      } catch (error) {
        toast.error((error as any).response?.data?.error?.message || `Failed to upload ${file.name}`);
      }
    }
    loadDocuments();
  }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await DocumentService.delete(confirmDelete.id);
      setDocuments(documents.filter((d) => d.id !== confirmDelete.id));
      toast.success('Document deleted');
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async (doc: DocumentRecord) => {
    try {
      const full = await DocumentService.get(doc.id);
      setPreview(full);
    } catch {
      toast.error('Failed to load preview');
    }
  };

  const handleCompress = async (doc: DocumentRecord) => {
    try {
      const full = await DocumentService.get(doc.id);
      if (full.content) {
        setText(full.content);
        navigate('/compress');
      }
    } catch {
      toast.error('Failed to load document');
    }
  };

  const openQuickCompress = (doc: DocumentRecord) => {
    setQuickCompressDoc(doc);
    setQuickResult(null);
    setQuickLevel('medium');
  };

  const runQuickCompress = async () => {
    if (!quickCompressDoc) return;
    setQuickBusy(true);
    try {
      const full = await DocumentService.get(quickCompressDoc.id);
      if (!full.content) throw new Error('Document has no content');
      const result = await CompressionService.compress({
        text: full.content,
        level: quickLevel,
        filename: quickCompressDoc.originalName,
      });
      setQuickResult(result);
      toast.success(`Compressed by ${Math.round(result.compressionRatio * 100)}%`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Compression failed');
    } finally {
      setQuickBusy(false);
    }
  };

  const downloadCompressed = () => {
    if (!quickResult || !quickCompressDoc) return;
    const base = quickCompressDoc.originalName.replace(/\.[^.]+$/, '');
    const filename = `${base}-compressed-${quickLevel}.txt`;
    const blob = new Blob([quickResult.compressedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Compressed file downloaded');
  };

  const handleDownload = (doc: DocumentRecord) => {
    // Use the streaming endpoint to serve the original binary file.
    // Token is passed as a query param because <a href> can't set headers.
    const token = useAuthStore.getState().token;
    if (!token) {
      toast.error('Not authenticated');
      return;
    }
    const url = `/api/documents/${doc.id}/download?token=${encodeURIComponent(token)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filtered = useMemo(() => {
    let result = documents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.originalName.toLowerCase().includes(q));
    }
    if (typeFilter) {
      result = result.filter((d) => d.documentType === typeFilter);
    }
    const [field, order] = sortBy.split('-');
    result = [...result].sort((a, b) => {
      const aVal = (a as any)[field];
      const bVal = (b as any)[field];
      if (order === 'desc') return aVal < bVal ? 1 : -1;
      return aVal > bVal ? 1 : -1;
    });
    return result;
  }, [documents, search, typeFilter, sortBy]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(documents.map((d) => d.documentType));
    return Array.from(types).map((t) => ({ value: t, label: t }));
  }, [documents]);

  if (loading) return <CenteredSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Manage your uploaded files"
        actions={
          <div className="flex items-center gap-1 bg-[hsl(var(--secondary))] rounded-lg p-0.5">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded ${view === 'grid' ? 'bg-[hsl(var(--card))]' : ''}`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded ${view === 'table' ? 'bg-[hsl(var(--card))]' : ''}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <FileUpload onFilesAccepted={handleUpload} maxFiles={5} />

      {documents.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search documents..."
            className="sm:max-w-md"
          />
          <FilterBar
            filters={[
              {
                key: 'type',
                label: 'Types',
                options: uniqueTypes,
                value: typeFilter,
                onChange: setTypeFilter,
              },
              {
                key: 'sort',
                label: 'Sort',
                options: [
                  { value: 'createdAt-desc', label: 'Newest first' },
                  { value: 'createdAt-asc', label: 'Oldest first' },
                  { value: 'originalName-asc', label: 'Name A-Z' },
                  { value: 'size-desc', label: 'Largest first' },
                ],
                value: sortBy,
                onChange: setSortBy,
              },
            ]}
            onClearAll={() => {
              setTypeFilter('');
              setSortBy('createdAt-desc');
              setSearch('');
            }}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={documents.length === 0 ? 'No documents yet' : 'No results'}
          description={documents.length === 0 ? 'Upload a file to get started' : 'Try adjusting your search or filters'}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc, index) => {
            const Icon = typeIcons[doc.documentType] || FileText;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className="glass-card p-4 hover:border-[hsl(var(--primary))]/30 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center text-[hsl(var(--primary))] flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.originalName}</p>
                    <Badge variant="primary" className="mt-1 capitalize">
                      {doc.documentType}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="p-1.5 bg-[hsl(var(--secondary))] rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Size</p>
                    <p className="font-medium">{(doc.size / 1024).toFixed(1)}KB</p>
                  </div>
                  <div className="p-1.5 bg-[hsl(var(--secondary))] rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Words</p>
                    <p className="font-medium">{doc.words ? formatNumber(doc.words) : '-'}</p>
                  </div>
                  <div className="p-1.5 bg-[hsl(var(--secondary))] rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Tokens</p>
                    <p className="font-medium">{doc.tokens ? formatNumber(doc.tokens) : '-'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--border))]">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(doc.createdAt)}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePreview(doc)}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openQuickCompress(doc)}
                      className="p-1.5 hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors"
                      title="Compress & Download"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleCompress(doc)}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Open in Compress page"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Download original"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(doc)}
                      className="p-1.5 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (d: DocumentRecord) => {
                  const Icon = typeIcons[d.documentType] || FileText;
                  return (
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                      <span className="font-medium">{d.originalName}</span>
                    </div>
                  );
                },
              },
              {
                key: 'type',
                header: 'Type',
                render: (d: DocumentRecord) => (
                  <Badge variant="primary" className="capitalize">{d.documentType}</Badge>
                ),
              },
              { key: 'size', header: 'Size', align: 'right', render: (d) => `${(d.size / 1024).toFixed(1)}KB` },
              { key: 'words', header: 'Words', align: 'right', render: (d) => (d.words ? formatNumber(d.words) : '-') },
              { key: 'tokens', header: 'Tokens', align: 'right', render: (d) => (d.tokens ? formatNumber(d.tokens) : '-') },
              { key: 'createdAt', header: 'Uploaded', render: (d) => formatDate(d.createdAt) },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (d) => (
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(d); }}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openQuickCompress(d); }}
                      className="p-1.5 hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] rounded-lg transition-colors"
                      title="Compress & Download"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCompress(d); }}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Open in Compress page"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(d); }}
                      className="p-1.5 hover:bg-[hsl(var(--secondary))] rounded-lg transition-colors"
                      title="Download original"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}
                      className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(d) => d.id}
          />
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.originalName}
        size="xl"
      >
        {preview && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Characters</p>
                <p className="font-semibold">{formatNumber(preview.characters || 0)}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Words</p>
                <p className="font-semibold">{formatNumber(preview.words || 0)}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Tokens</p>
                <p className="font-semibold">{formatNumber(preview.tokens || 0)}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Type</p>
                <p className="font-semibold capitalize">{preview.documentType}</p>
              </div>
            </div>
            <pre className="text-xs font-mono bg-[hsl(var(--input))] p-4 rounded-xl overflow-auto max-h-96 whitespace-pre-wrap border border-[hsl(var(--border))]">
              {preview.content?.slice(0, 10000) || 'No content available'}
              {preview.content && preview.content.length > 10000 && (
                <span className="text-[hsl(var(--muted-foreground))]">
                  {'\n\n... [truncated, showing first 10K characters]'}
                </span>
              )}
            </pre>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={() => handleDownload(preview)}>
                Download
              </Button>
              <Button variant="gradient" leftIcon={<Minimize2 className="w-3.5 h-3.5" />} onClick={() => { handleCompress(preview); setPreview(null); }}>
                Compress
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete document?"
        description={`"${confirmDelete?.originalName}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {/* Quick Compress modal */}
      <Modal
        open={!!quickCompressDoc}
        onClose={() => { setQuickCompressDoc(null); setQuickResult(null); }}
        title="Compress & Download"
        description={quickCompressDoc?.originalName}
        size="lg"
      >
        {quickCompressDoc && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Type</p>
                <p className="font-semibold capitalize">{quickCompressDoc.documentType}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Words</p>
                <p className="font-semibold">{formatNumber(quickCompressDoc.words || 0)}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Tokens</p>
                <p className="font-semibold">{formatNumber(quickCompressDoc.tokens || 0)}</p>
              </div>
              <div className="p-2 bg-[hsl(var(--secondary))] rounded-lg text-center">
                <p className="text-[hsl(var(--muted-foreground))]">Size</p>
                <p className="font-semibold">{(quickCompressDoc.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>

            {!quickResult ? (
              <>
                <div className="mb-4">
                  <Select
                    label="Compression Level"
                    value={quickLevel}
                    onChange={(e) => setQuickLevel(e.target.value as CompressionLevel)}
                    options={[
                      { value: 'low', label: 'Low — gentle, preserves most content (~30%)' },
                      { value: 'medium', label: 'Medium — balanced (~50%)' },
                      { value: 'high', label: 'High — aggressive (~70%)' },
                      { value: 'extreme', label: 'Extreme — maximum reduction (~85%)' },
                    ]}
                  />
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                  This runs the multi-agent pipeline on the document's extracted text and produces
                  a compressed <strong>.txt</strong> file. The original PDF stays unchanged.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setQuickCompressDoc(null)} disabled={quickBusy}>
                    Cancel
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={runQuickCompress}
                    loading={quickBusy}
                    leftIcon={!quickBusy ? <Sparkles className="w-4 h-4" /> : undefined}
                  >
                    Compress
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
                  <div className="p-2.5 bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Compression</p>
                    <p className="text-lg font-bold text-[hsl(var(--primary))]">
                      {Math.round(quickResult.compressionRatio * 100)}%
                    </p>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Tokens saved</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatNumber(quickResult.originalTokens - quickResult.compressedTokens)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-center">
                    <p className="text-[hsl(var(--muted-foreground))]">Accuracy</p>
                    <p className="text-lg font-bold text-cyan-400">
                      {Math.round(quickResult.semanticScore * 100)}%
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-medium mb-1 text-[hsl(var(--muted-foreground))]">
                    Compressed output ({formatNumber(quickResult.compressedTokens)} tokens)
                  </p>
                  <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-48 overflow-auto whitespace-pre-wrap border border-[hsl(var(--border))]">
                    {quickResult.compressedText.slice(0, 3000)}
                    {quickResult.compressedText.length > 3000 && (
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {'\n... [truncated preview]'}
                      </span>
                    )}
                  </pre>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setQuickResult(null)}>
                    Try Different Level
                  </Button>
                  <Button variant="gradient" leftIcon={<Download className="w-4 h-4" />} onClick={downloadCompressed}>
                    Download Compressed .txt
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
