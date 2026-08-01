import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch, FileText, Type, Hash, Braces, Languages, Gauge,
  DollarSign, TrendingUp, Sparkles, Copy,
} from 'lucide-react';
import { CompressionService, PlaygroundService } from '../services';
import { formatNumber, formatCurrency } from '../lib/utils';
import { PageHeader, StatCard } from '../components/shared';
import { Card, Button, EmptyState, CenteredSpinner, Badge } from '../components/ui';
import { FileUpload } from '../components/shared/FileUpload';
import { DocumentService } from '../services';
import type { AnalysisResult } from '../types';

export default function PromptAnalysisPage() {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [tokenDetails, setTokenDetails] = useState<{ tokens: number; costs: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast.error('Please enter or upload text to analyze');
      return;
    }

    setLoading(true);
    try {
      const [analysisRes, tokenRes] = await Promise.all([
        CompressionService.analyze(text, file?.name),
        PlaygroundService.tokenCount(text),
      ]);
      setAnalysis(analysisRes);
      setTokenDetails(tokenRes);
      toast.success('Analysis complete');
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;

    setFile(f);
    try {
      const uploaded = await DocumentService.upload(f);
      setText(uploaded.content);
      toast.success(`"${f.name}" uploaded`);
    } catch (error) {
      toast.error((error as any).response?.data?.error?.message || 'Upload failed');
    }
  }, []);

  const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const namedEntities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g)?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Analysis"
        description="Deep-dive analysis of your prompts before compression"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <FileUpload
            onFilesAccepted={handleFileUpload}
            currentFile={file}
            onRemove={() => {
              setFile(null);
              setText('');
              setAnalysis(null);
              setTokenDetails(null);
            }}
            compact
          />

          <Card>
            <label className="block text-sm font-medium mb-2">Prompt Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your prompt, code, or document here for analysis..."
              className="w-full h-72 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-all"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span>{text.length} characters • {text.split(/\s+/).filter(Boolean).length} words</span>
              <span>~{Math.ceil(text.length / 4)} tokens</span>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <p className="text-sm font-semibold mb-3">Ready to analyze?</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
              Get deep insights: document type detection, language, readability, cost estimates
              across all providers, and compression recommendations.
            </p>
            <Button
              variant="gradient"
              className="w-full"
              onClick={handleAnalyze}
              disabled={!text.trim() || loading}
              loading={loading}
              leftIcon={!loading ? <Sparkles className="w-4 h-4" /> : undefined}
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Card>

          {text && (
            <Card>
              <p className="text-sm font-semibold mb-3">Quick Copy</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  toast.success('Copied');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/80 transition-colors text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy prompt to clipboard
              </button>
            </Card>
          )}
        </div>
      </div>

      <AnimatePresence>
        {loading && !analysis && <CenteredSpinner />}

        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <StatCard label="Words" value={formatNumber(analysis.words)} icon={Type} iconColor="text-violet-400" delay={0} />
              <StatCard label="Characters" value={formatNumber(analysis.characters)} icon={Hash} iconColor="text-cyan-400" delay={0.05} />
              <StatCard label="Sentences" value={formatNumber(analysis.sentences)} icon={FileText} iconColor="text-emerald-400" delay={0.1} />
              <StatCard label="Paragraphs" value={formatNumber(paragraphCount)} icon={Braces} iconColor="text-amber-400" delay={0.15} />
              <StatCard label="Tokens" value={formatNumber(analysis.tokens)} icon={Gauge} iconColor="text-pink-400" delay={0.2} />
              <StatCard label="Readability" value={`${analysis.readabilityScore}/100`} icon={TrendingUp} iconColor="text-blue-400" delay={0.25} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card padding="lg">
                <div className="flex items-center gap-2 mb-3">
                  <FileSearch className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-semibold">Document Profile</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Type</span>
                    <Badge variant="primary" className="capitalize">
                      {analysis.documentType}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Language</span>
                    <div className="flex items-center gap-1">
                      <Languages className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                      <span className="font-medium capitalize">English</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[hsl(var(--muted-foreground))]">Readability</span>
                    <span className="font-medium">{analysis.readabilityScore}/100</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
                    <span className="text-[hsl(var(--muted-foreground))]">Recommended level</span>
                    <Badge variant="primary" className="capitalize">
                      {analysis.recommendation}
                    </Badge>
                  </div>
                </div>
              </Card>

              <Card padding="lg" className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-semibold">Cost Estimation by Provider</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(analysis.costs).map(([provider, cost]) => (
                    <div
                      key={provider}
                      className="p-2.5 bg-[hsl(var(--secondary))] rounded-lg"
                    >
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        {provider}
                      </p>
                      <p className="text-sm font-semibold mt-0.5">{formatCurrency(cost)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {namedEntities.length > 0 && (
              <Card padding="lg">
                <h3 className="text-sm font-semibold mb-3">Detected Named Entities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {namedEntities.map((entity, i) => (
                    <Badge key={i} variant="info">
                      {entity}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {tokenDetails && (
              <Card padding="lg">
                <h3 className="text-sm font-semibold mb-3">Token Distribution</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 rounded-xl">
                    <span className="text-sm font-medium">Total tokens</span>
                    <span className="text-lg font-bold text-[hsl(var(--primary))]">
                      {formatNumber(tokenDetails.tokens)}
                    </span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Estimated using GPT-style tokenization (~4 chars per token for text, ~3.5 for code).
                    Actual token count may vary by provider tokenizer.
                  </p>
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {!analysis && !loading && !text && (
          <EmptyState
            icon={FileSearch}
            title="Ready to analyze"
            description="Upload a file or paste your prompt to get a detailed breakdown."
          />
        )}
      </AnimatePresence>
    </div>
  );
}
