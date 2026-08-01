import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Copy, RotateCcw,
  Gauge, Brain, DollarSign, Clock, Settings2, Sparkles,
} from 'lucide-react';
import { formatNumber, formatCurrency, formatPercentage } from '../lib/utils';
import { CompressionService, DocumentService } from '../services';
import { useCompressionStore } from '../store';
import type { CompressionLevel } from '../types';
import { PageHeader, FileUpload, LLMSelector, StatCard, ComparisonCard, CodeViewer } from '../components/shared';
import { Card, Button, Badge, Switch, ConfirmDialog } from '../components/ui';

const COMPRESSION_LEVELS: Array<{ value: CompressionLevel; label: string; desc: string; color: string }> = [
  { value: 'low', label: 'Low', desc: '~30%', color: 'text-emerald-400' },
  { value: 'medium', label: 'Medium', desc: '~50%', color: 'text-amber-400' },
  { value: 'high', label: 'High', desc: '~70%', color: 'text-orange-400' },
  { value: 'extreme', label: 'Extreme', desc: '~85%', color: 'text-red-400' },
];

const COMPRESSION_METHODS = [
  { value: 'semantic', label: 'Semantic', desc: 'Preserve meaning, rewrite verbose text' },
  { value: 'extractive', label: 'Extractive', desc: 'Keep most important sentences' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Combine semantic and extractive' },
  { value: 'code-aware', label: 'Code Aware', desc: 'Optimized for source code' },
];

export default function CompressPage() {
  const {
    currentText: text, currentLevel: level, currentProvider: provider,
    currentResult: result, isCompressing: compressing,
    setText, setLevel, setProvider, setResult, setCompressing, reset,
  } = useCompressionStore();

  const [method, setMethod] = useState('semantic');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [agents, setAgents] = useState({
    duplicateRemoval: true,
    boilerplateRemoval: true,
    codeCompression: true,
    logCompression: true,
    semanticCompression: true,
  });

  const handleFileUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadedFile(file);
    try {
      const uploaded = await DocumentService.upload(file);
      setText(uploaded.content);
      toast.success(`"${file.name}" uploaded`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Upload failed');
    }
  }, [setText]);

  const handleCompress = async () => {
    if (!text.trim()) {
      toast.error('Please enter text or upload a file');
      return;
    }
    setCompressing(true);
    try {
      const res = await CompressionService.compress({
        text, level, llmProvider: provider,
        filename: uploadedFile?.name,
      });
      setResult(res);
      toast.success(`Compressed in ${res.pipeline?.totalTimeMs ?? '-'}ms`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Compression failed');
    } finally {
      setCompressing(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.compressedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compressed-prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    reset();
    setUploadedFile(null);
    setShowResetDialog(false);
  };

  const tokenEstimate = Math.ceil(text.length / 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compress Prompt"
        description="Reduce token usage with the multi-agent AI pipeline"
        actions={
          (text || result) && (
            <Button variant="ghost" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={() => setShowResetDialog(true)}>
              Reset
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-4">
          <FileUpload
            onFilesAccepted={handleFileUpload}
            currentFile={uploadedFile}
            onRemove={() => {
              setUploadedFile(null);
              setText('');
            }}
            compact
          />

          <Card>
            <label className="block text-sm font-medium mb-2">Input Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your prompt, code, document, or any text here..."
              className="w-full h-64 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-all"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>
                {text.length} characters • {text.split(/\s+/).filter(Boolean).length} words
              </span>
              <span>~{tokenEstimate} tokens</span>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Compression Level */}
          <Card>
            <label className="block text-sm font-medium mb-3">Compression Level</label>
            <div className="grid grid-cols-2 gap-2">
              {COMPRESSION_LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={`flex flex-col items-start p-2.5 rounded-lg border transition-all text-left ${
                    level === l.value
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30'
                  }`}
                >
                  <span className="text-sm font-medium">{l.label}</span>
                  <span className={`text-xs ${l.color}`}>{l.desc}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Compression Method */}
          <Card>
            <label className="block text-sm font-medium mb-3">Compression Method</label>
            <div className="space-y-1.5">
              {COMPRESSION_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    method === m.value
                      ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20'
                      : 'hover:bg-[hsl(var(--secondary))] border border-transparent'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      method === m.value
                        ? 'border-[hsl(var(--primary))]'
                        : 'border-[hsl(var(--border))]'
                    }`}
                  >
                    {method === m.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{m.label}</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* LLM Provider */}
          <Card>
            <label className="block text-sm font-medium mb-3">Target LLM</label>
            <LLMSelector value={provider} onChange={setProvider} tokens={tokenEstimate} />
          </Card>

          {/* Agent Toggles */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-[hsl(var(--primary))]" />
              <label className="text-sm font-medium">Agent Configuration</label>
            </div>
            <div className="space-y-2.5">
              <Switch
                checked={agents.duplicateRemoval}
                onChange={(v) => setAgents({ ...agents, duplicateRemoval: v })}
                label="Duplicate Removal"
              />
              <Switch
                checked={agents.boilerplateRemoval}
                onChange={(v) => setAgents({ ...agents, boilerplateRemoval: v })}
                label="Boilerplate Removal"
              />
              <Switch
                checked={agents.codeCompression}
                onChange={(v) => setAgents({ ...agents, codeCompression: v })}
                label="Code Compression"
              />
              <Switch
                checked={agents.logCompression}
                onChange={(v) => setAgents({ ...agents, logCompression: v })}
                label="Log Compression"
              />
              <Switch
                checked={agents.semanticCompression}
                onChange={(v) => setAgents({ ...agents, semanticCompression: v })}
                label="Semantic Compression"
              />
            </div>
          </Card>

          <Button
            variant="gradient"
            className="w-full"
            onClick={handleCompress}
            disabled={!text.trim() || compressing}
            loading={compressing}
            leftIcon={!compressing ? <Sparkles className="w-4 h-4" /> : undefined}
          >
            {compressing ? 'Running pipeline...' : 'Compress Now'}
          </Button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Compression" value={formatPercentage(result.compressionRatio)} icon={Gauge} iconColor="text-violet-400" />
              <StatCard label="Semantic Score" value={formatPercentage(result.semanticScore)} icon={Brain} iconColor="text-cyan-400" delay={0.05} />
              <StatCard label="Cost Saved" value={formatCurrency(result.costSavings)} icon={DollarSign} iconColor="text-emerald-400" delay={0.1} />
              <StatCard label="Latency" value={`${result.latency}ms`} icon={Clock} iconColor="text-amber-400" delay={0.15} />
            </div>

            {/* Comparison */}
            <ComparisonCard
              leftLabel="Original"
              leftValue={formatNumber(result.originalTokens)}
              leftSubtext="tokens"
              rightLabel="Compressed"
              rightValue={formatNumber(result.compressedTokens)}
              rightSubtext="tokens"
              improvement={`${formatPercentage(result.compressionRatio)} smaller`}
              improvementPositive
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="error">Original ({formatNumber(result.originalTokens)} tokens)</Badge>
                  <Button variant="ghost" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => handleCopy(result.originalText)}>
                    Copy
                  </Button>
                </div>
                <CodeViewer code={result.originalText} maxHeight="320px" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="success">Compressed ({formatNumber(result.compressedTokens)} tokens)</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => handleCopy(result.compressedText)}>
                      Copy
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={handleDownload}>
                      Download
                    </Button>
                  </div>
                </div>
                <CodeViewer code={result.compressedText} maxHeight="320px" allowDownload filename="compressed.txt" />
              </div>
            </div>

            {/* Pipeline Details */}
            {result.pipeline && (
              <Card padding="lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-semibold">Multi-Agent Pipeline Execution</h3>
                  <Badge variant="primary">{result.pipeline.agentsExecuted} agents</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {result.pipeline.agentResults.map((a) => (
                    <div
                      key={a.agent}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                        a.status === 'success'
                          ? 'bg-emerald-500/5 border border-emerald-500/10'
                          : a.status === 'skipped'
                          ? 'bg-[hsl(var(--secondary))] opacity-60'
                          : 'bg-red-500/5 border border-red-500/10'
                      }`}
                    >
                      <span className="font-medium truncate">{a.agent.replace(/_/g, ' ')}</span>
                      <span className="text-[hsl(var(--muted-foreground))] flex-shrink-0 ml-1">
                        {a.timeMs}ms
                      </span>
                    </div>
                  ))}
                </div>

                {result.pipeline.validation && (
                  <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Semantic similarity</p>
                      <p className="text-sm font-semibold">
                        {formatPercentage(result.pipeline.validation.semanticSimilarity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Reasoning retained</p>
                      <p className="text-sm font-semibold">
                        {formatPercentage(result.pipeline.validation.reasoningRetention)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Est. accuracy</p>
                      <p className="text-sm font-semibold">
                        {formatPercentage(result.pipeline.validation.estimatedAccuracy)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Approved</p>
                      <Badge variant={result.pipeline.validation.approved ? 'success' : 'error'}>
                        {result.pipeline.validation.approved ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Reset compression?"
        description="This will clear the current text and result. This action cannot be undone."
        confirmLabel="Reset"
        variant="warning"
      />
    </div>
  );
}
