import { useMemo, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Copy, ArrowRightLeft, Terminal, FileJson, Zap, Sparkles,
  TrendingDown, Clock, DollarSign, Target, GitCompare,
} from 'lucide-react';
import { PlaygroundService, type BenchmarkResult, type ProviderModelCatalog } from '../../services';
import { useAuthStore } from '../../store';
import { formatNumber, cn } from '../../lib/utils';
import { generateAllSnippets } from '../../lib/snippets';
import { CodeViewer } from '../../components/shared';
import { Card, Button, Select, Tabs, Badge } from '../../components/ui';

const SAMPLE_PROMPTS: Record<string, { title: string; text: string }> = {
  verbose: {
    title: 'Verbose Business Text',
    text: `It is important to note that, in order to properly evaluate the compression engine, we should take into consideration the fact that reducing token payload has multiple downstream effects. Basically, due to the fact that most LLM providers charge per token, any reduction in prompt size directly translates into cost savings. Furthermore, it goes without saying that shorter prompts also result in faster inference times, which improves user experience. In light of the fact that many production applications send thousands of prompts per day, even a small percentage reduction can compound into significant savings over time. As previously mentioned, our multi-agent pipeline has been carefully designed to preserve semantic meaning while aggressively removing redundant content.`,
  },
  documentation: {
    title: 'Technical Documentation',
    text: `The CompressionAI platform provides a REST API for prompt compression. To use the API, developers must first authenticate using JWT tokens. Once authenticated, they can send POST requests to the /api/compression/compress endpoint. The request body should contain a "text" field with the prompt to compress, an optional "level" field (low, medium, high, or extreme), and an optional "llmProvider" field. The response includes the compressed text, token counts, compression ratio, semantic score, and cost savings. Rate limiting is applied at 100 requests per 15 minutes per user. For higher limits, contact support.`,
  },
  reasoning: {
    title: 'Complex Reasoning',
    text: `Consider a scenario where a company has three warehouses located in different cities. Warehouse A stores 500 units of Product X, Warehouse B stores 300 units, and Warehouse C stores 200 units. The company needs to fulfill an order of 700 units. Due to shipping costs, it's more economical to ship from the closest warehouse to the customer. If the customer is closest to Warehouse A, then Warehouse B, and finally Warehouse C, calculate the optimal distribution and explain why this approach minimizes total shipping cost while ensuring the order is fulfilled completely.`,
  },
};

export default function BenchmarkPanel() {
  const [providers, setProviders] = useState<ProviderModelCatalog[]>([]);
  const [providerId, setProviderId] = useState('openai');
  const [model, setModel] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [compressedPrompt, setCompressedPrompt] = useState('');
  const [level, setLevel] = useState('medium');
  const [running, setRunning] = useState(false);
  const [autoCompressing, setAutoCompressing] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  // Load provider catalog on mount
  useEffect(() => {
    PlaygroundService.getModels()
      .then((data) => {
        setProviders(data);
        const initial = data.find((p) => p.id === providerId);
        if (initial) setModel(initial.defaultModel);
      })
      .catch(() => {
        // Fallback to empty; will re-attempt on next interaction
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync model when provider changes
  useEffect(() => {
    const p = providers.find((x) => x.id === providerId);
    if (p) setModel(p.defaultModel);
  }, [providerId, providers]);

  const currentProvider = providers.find((p) => p.id === providerId);

  // Live token counts (rough client-side estimate)
  const originalTokens = Math.ceil(originalPrompt.length / 4);
  const compressedTokens = Math.ceil(compressedPrompt.length / 4);
  const tokenSavings = originalTokens - compressedTokens;

  const handleAutoCompress = async () => {
    if (!originalPrompt.trim()) {
      toast.error('Enter an original prompt first');
      return;
    }
    setAutoCompressing(true);
    try {
      const res = await PlaygroundService.compressAndCompare({
        text: originalPrompt,
        level,
        provider: providerId,
      });
      setCompressedPrompt(res.compressed.text);
      toast.success(`Compressed by ${Math.round(res.metrics.compressionRatio * 100)}%`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Auto-compression failed');
    } finally {
      setAutoCompressing(false);
    }
  };

  const handleRunBenchmark = async () => {
    if (!originalPrompt.trim()) {
      toast.error('Enter an original prompt');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const data = await PlaygroundService.benchmark({
        originalPrompt,
        compressedPrompt: compressedPrompt.trim() || undefined,
        provider: providerId,
        model: model || undefined,
        level,
      });
      setResult(data);
      // If we auto-generated the compressed prompt, sync it back to the editor
      if (!compressedPrompt.trim()) {
        setCompressedPrompt(data.compressed.prompt);
      }
      toast.success(`Benchmark complete: ${data.telemetry.fidelity.scorePct.toFixed(1)}% fidelity`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Benchmark failed');
    } finally {
      setRunning(false);
    }
  };

  const loadSample = (key: keyof typeof SAMPLE_PROMPTS) => {
    setOriginalPrompt(SAMPLE_PROMPTS[key].text);
    setCompressedPrompt('');
    setResult(null);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Build code snippets from the current benchmark payload
  const snippets = useMemo(() => {
    const token = useAuthStore.getState().token || 'YOUR_TOKEN';
    return generateAllSnippets({
      endpoint: '/api/playground/benchmark',
      method: 'POST',
      body: {
        originalPrompt: originalPrompt || '(your prompt here)',
        compressedPrompt: compressedPrompt || undefined,
        provider: providerId,
        model,
        level,
      },
      baseUrl: window.location.origin,
      authTokenPreview: token.slice(0, 20),
    });
  }, [originalPrompt, compressedPrompt, providerId, model, level]);

  return (
    <div className="space-y-6">
      {/* Provider + Model selection */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Provider"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            options={
              providers.length > 0
                ? providers.map((p) => ({ value: p.id, label: p.name }))
                : [{ value: 'openai', label: 'OpenAI' }]
            }
          />
          <Select
            label="Model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            options={
              currentProvider
                ? currentProvider.models.map((m: string) => ({ value: m, label: m }))
                : [{ value: '', label: 'Loading…' }]
            }
          />
          <Select
            label="Compression Level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={[
              { value: 'low', label: 'Low (~30%)' },
              { value: 'medium', label: 'Medium (~50%)' },
              { value: 'high', label: 'High (~70%)' },
              { value: 'extreme', label: 'Extreme (~85%)' },
            ]}
          />
        </div>

        {currentProvider && (
          <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Context window: <strong>{(currentProvider.contextWindow / 1000).toFixed(0)}K</strong></span>
            <span>Input: <strong>${currentProvider.costPer1kInput}/1K</strong></span>
            <span>Output: <strong>${currentProvider.costPer1kOutput}/1K</strong></span>
          </div>
        )}
      </Card>

      {/* Sample prompt shortcuts */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-[hsl(var(--muted-foreground))] self-center">Try a sample:</span>
        {Object.entries(SAMPLE_PROMPTS).map(([key, sample]) => (
          <button
            key={key}
            onClick={() => loadSample(key as keyof typeof SAMPLE_PROMPTS)}
            className="px-2.5 py-1 text-xs rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70 transition-colors"
          >
            {sample.title}
          </button>
        ))}
      </div>

      {/* Side-by-side prompt editors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="error">Original</Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Full prompt request</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>~{formatNumber(originalTokens)} tokens</span>
            </div>
          </div>
          <textarea
            value={originalPrompt}
            onChange={(e) => setOriginalPrompt(e.target.value)}
            placeholder="Paste your uncompressed prompt here..."
            className="w-full h-56 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="success">Compressed</Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">ContextIQ payload</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              {tokenSavings > 0 && (
                <span className="text-emerald-400">−{formatNumber(tokenSavings)}</span>
              )}
              <span>~{formatNumber(compressedTokens)} tokens</span>
            </div>
          </div>
          <textarea
            value={compressedPrompt}
            onChange={(e) => setCompressedPrompt(e.target.value)}
            placeholder="Leave empty to auto-compress, or paste a custom compressed version..."
            className="w-full h-56 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              loading={autoCompressing}
              disabled={!originalPrompt.trim()}
              onClick={handleAutoCompress}
              leftIcon={!autoCompressing ? <Sparkles className="w-3.5 h-3.5" /> : undefined}
            >
              {autoCompressing ? 'Compressing…' : 'Auto-compress from Original'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Run benchmark */}
      <div className="flex justify-center">
        <Button
          variant="gradient"
          size="lg"
          loading={running}
          disabled={!originalPrompt.trim() || running}
          onClick={handleRunBenchmark}
          leftIcon={!running ? <Play className="w-4 h-4" /> : undefined}
          className="min-w-[240px]"
        >
          {running ? 'Running benchmark…' : 'Run Parallel Benchmark'}
        </Button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-4"
          >
            {/* Telemetry dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <TelemetryStat
                icon={TrendingDown}
                iconColor="text-violet-400"
                label="Input Tokens Saved"
                primary={formatNumber(result.telemetry.tokensSaved)}
                secondary={`${result.telemetry.tokenReductionPct.toFixed(1)}% reduction`}
              />
              <TelemetryStat
                icon={Target}
                iconColor="text-cyan-400"
                label="Reasoning Fidelity"
                primary={`${result.telemetry.fidelity.scorePct.toFixed(1)}%`}
                secondary={result.telemetry.fidelity.verdict}
                secondaryColor={verdictColor(result.telemetry.fidelity.verdict)}
              />
              <TelemetryStat
                icon={Clock}
                iconColor="text-amber-400"
                label="Latency"
                primary={`${result.original.latencyMs}→${result.compressed.latencyMs}ms`}
                secondary={
                  result.telemetry.latencyImprovementPct > 0
                    ? `${result.telemetry.latencyImprovementPct.toFixed(0)}% faster`
                    : 'no gain'
                }
                secondaryColor={result.telemetry.latencyImprovementPct > 0 ? 'text-emerald-400' : ''}
              />
              <TelemetryStat
                icon={DollarSign}
                iconColor="text-emerald-400"
                label="Cost Saved / Call"
                primary={`$${result.telemetry.costSaved.toFixed(6)}`}
                secondary={`${result.telemetry.costSavedMicroUsd} µUSD`}
              />
            </div>

            {(result.original.simulated || result.compressed.simulated) && (
              <div className="glass-card p-3 border-l-4 border-l-amber-400 flex items-center gap-2 text-xs">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  This benchmark used a simulated response for {result.provider}. Add a real API key
                  in Settings for actual latency and quality measurements.
                </span>
              </div>
            )}

            {/* Tabbed results */}
            <Tabs
              tabs={[
                {
                  id: 'outputs',
                  label: 'Model Outputs',
                  icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
                  content: (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card padding="md">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="error">
                            Original ({formatNumber(result.original.inputTokens)} in / {formatNumber(result.original.outputTokens)} out)
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Copy className="w-3.5 h-3.5" />}
                            onClick={() => copy(result.original.response, 'Response')}
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-96 overflow-auto whitespace-pre-wrap">
                          {result.original.response || '(empty)'}
                        </pre>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                          {result.original.latencyMs}ms • ${result.original.cost.toFixed(6)}
                        </p>
                      </Card>

                      <Card padding="md">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="success">
                            Compressed ({formatNumber(result.compressed.inputTokens)} in / {formatNumber(result.compressed.outputTokens)} out)
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Copy className="w-3.5 h-3.5" />}
                            onClick={() => copy(result.compressed.response, 'Response')}
                          >
                            Copy
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-96 overflow-auto whitespace-pre-wrap">
                          {result.compressed.response || '(empty)'}
                        </pre>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                          {result.compressed.latencyMs}ms • ${result.compressed.cost.toFixed(6)}
                        </p>
                      </Card>
                    </div>
                  ),
                },
                {
                  id: 'telemetry',
                  label: 'Telemetry JSON',
                  icon: <FileJson className="w-3.5 h-3.5" />,
                  content: (
                    <CodeViewer
                      code={JSON.stringify(result, null, 2)}
                      language="json"
                      maxHeight="500px"
                      filename="benchmark.json"
                      allowDownload
                    />
                  ),
                },
                {
                  id: 'snippets',
                  label: 'API Code Snippets',
                  icon: <Terminal className="w-3.5 h-3.5" />,
                  content: (
                    <Tabs
                      tabs={snippets.map((s) => ({
                        id: s.language,
                        label: s.label,
                        content: (
                          <CodeViewer
                            code={s.code}
                            language={s.language}
                            filename={s.filename}
                            maxHeight="440px"
                            allowDownload
                          />
                        ),
                      }))}
                    />
                  ),
                },
                {
                  id: 'fidelity',
                  label: 'Fidelity Breakdown',
                  icon: <GitCompare className="w-3.5 h-3.5" />,
                  content: (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <FidelityStat label="Overall score" value={`${result.telemetry.fidelity.scorePct.toFixed(1)}%`} verdict={result.telemetry.fidelity.verdict} />
                      <FidelityStat label="Cosine similarity" value={`${(result.telemetry.fidelity.cosineSimilarity * 100).toFixed(1)}%`} />
                      <FidelityStat label="Entity retention" value={`${(result.telemetry.fidelity.entityPreservation * 100).toFixed(1)}%`} />
                      <FidelityStat label="Length ratio" value={`${(result.telemetry.fidelity.lengthRatio * 100).toFixed(1)}%`} />
                    </div>
                  ),
                },
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function verdictColor(verdict: 'excellent' | 'good' | 'fair' | 'poor'): string {
  switch (verdict) {
    case 'excellent': return 'text-emerald-400';
    case 'good': return 'text-cyan-400';
    case 'fair': return 'text-amber-400';
    case 'poor': return 'text-red-400';
  }
}

interface TelemetryStatProps {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  primary: string;
  secondary: string;
  secondaryColor?: string;
}

function TelemetryStat({ icon: Icon, iconColor, label, primary, secondary, secondaryColor }: TelemetryStatProps) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        <Icon className={cn('w-3.5 h-3.5', iconColor)} />
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold mt-1 tabular-nums">{primary}</p>
      <p className={cn('text-[10px] uppercase tracking-wider', secondaryColor)}>{secondary}</p>
    </div>
  );
}

function FidelityStat({ label, value, verdict }: { label: string; value: string; verdict?: 'excellent' | 'good' | 'fair' | 'poor' }) {
  return (
    <div className="glass-card p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="text-lg font-bold mt-1 tabular-nums">{value}</p>
      {verdict && (
        <Badge
          variant={verdict === 'excellent' || verdict === 'good' ? 'success' : verdict === 'fair' ? 'warning' : 'error'}
          className="mt-1"
        >
          {verdict}
        </Badge>
      )}
    </div>
  );
}
