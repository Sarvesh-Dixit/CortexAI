import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Copy, Download, Minimize2,
  ScanText, Eye, X, Sparkles, TrendingDown, Zap, FileText,
} from 'lucide-react';
import { OcrService, type OcrExtractResult, type OcrCompressResult } from '../services';
import { useCompressionStore } from '../store';
import { formatNumber, cn } from '../lib/utils';
import type { CompressionLevel } from '../types';
import { PageHeader, StatCard, LLMSelector } from '../components/shared';
import { Card, Button, Select, Badge, CenteredSpinner } from '../components/ui';

const SUPPORTED_MIME = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tif', '.tiff'],
};

export default function OcrPage() {
  const navigate = useNavigate();
  const { setText } = useCompressionStore();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState('eng');
  const [level, setLevel] = useState<CompressionLevel>('medium');
  const [provider, setProvider] = useState('openai');
  const [languages, setLanguages] = useState<Array<{ code: string; name: string }>>([]);

  const [extracting, setExtracting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [extractResult, setExtractResult] = useState<OcrExtractResult | null>(null);
  const [compressResult, setCompressResult] = useState<OcrCompressResult | null>(null);
  const [mode, setMode] = useState<'extract' | 'compress'>('extract');

  useEffect(() => {
    OcrService.getLanguages()
      .then(setLanguages)
      .catch(() => setLanguages([{ code: 'eng', name: 'English' }]));
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setExtractResult(null);
    setCompressResult(null);
    // Local preview
    const url = URL.createObjectURL(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_MIME,
    maxFiles: 1,
  });

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setCompressResult(null);
    try {
      const result = await OcrService.extract(file, language);
      setExtractResult(result);
      toast.success(`Extracted ${result.words} words with ${Math.round(result.confidence)}% confidence`);
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.error?.message ||
        'OCR failed';
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractAndCompress = async () => {
    if (!file) return;
    setCompressing(true);
    setExtractResult(null);
    try {
      const result = await OcrService.compress(file, language, level, provider);
      setCompressResult(result);
      toast.success(
        `Extracted + compressed by ${Math.round(result.compression.compressionRatio * 100)}%`
      );
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.response?.data?.error?.message ||
        'Extract & compress failed';
      toast.error(msg);
    } finally {
      setCompressing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setExtractResult(null);
    setCompressResult(null);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadText = (text: string, name: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const useInCompress = (text: string) => {
    setText(text);
    navigate('/compress');
    toast.success('Loaded into Compress page');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Image to Text (OCR)"
        description="Extract text from screenshots and images — save up to 90% on vision tokens"
        actions={
          <Badge variant="primary">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            Save on Vision Tokens
          </Badge>
        }
      />

      {/* Why this matters explanation */}
      <div className="glass-card p-4 flex items-start gap-3 border-l-4 border-l-[hsl(var(--primary))]">
        <TrendingDown className="w-5 h-5 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Why use OCR before sending to an LLM?</p>
          <p className="text-[hsl(var(--muted-foreground))] mt-1">
            A 1MB screenshot can cost <strong>2,000+ vision tokens</strong> on GPT-4V. The same
            content as extracted text is often under 500 tokens. Extract locally, compress, then
            send — pay 5-10x less for the same information.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: image upload */}
        <div className="lg:col-span-2 space-y-4">
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                'glass-card p-10 border-2 border-dashed cursor-pointer transition-all text-center',
                isDragActive
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/50'
              )}
            >
              <input {...getInputProps()} />
              <ImageIcon
                className={cn(
                  'w-12 h-12 mx-auto mb-3',
                  isDragActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'
                )}
              />
              <p className="text-sm font-medium">Drop a screenshot or image here</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                PNG, JPG, WebP, GIF, BMP, TIFF • Any size supported
              </p>
              <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-[hsl(var(--muted-foreground))]">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Runs locally
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> No data leaves your server
                </span>
              </div>
            </div>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <span className="text-sm font-medium truncate max-w-[280px]">{file.name}</span>
                  <Badge variant="default">{(file.size / 1024).toFixed(1)} KB</Badge>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1 hover:bg-red-500/10 text-[hsl(var(--muted-foreground))] hover:text-red-400 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {preview && (
                <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-[hsl(var(--input))] flex items-center justify-center">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full max-h-96 object-contain"
                  />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: controls */}
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 bg-[hsl(var(--secondary))] rounded-lg">
                <button
                  onClick={() => setMode('extract')}
                  className={cn(
                    'px-3 py-2 text-xs rounded-md font-medium transition-colors',
                    mode === 'extract'
                      ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                  )}
                >
                  Extract Only
                </button>
                <button
                  onClick={() => setMode('compress')}
                  className={cn(
                    'px-3 py-2 text-xs rounded-md font-medium transition-colors',
                    mode === 'compress'
                      ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                  )}
                >
                  Extract + Compress
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <Select
              label="OCR Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              options={
                languages.length > 0
                  ? languages.map((l) => ({ value: l.code, label: l.name }))
                  : [{ value: 'eng', label: 'English' }]
              }
            />
          </Card>

          {mode === 'compress' && (
            <>
              <Card>
                <Select
                  label="Compression Level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as CompressionLevel)}
                  options={[
                    { value: 'low', label: 'Low (~30%)' },
                    { value: 'medium', label: 'Medium (~50%)' },
                    { value: 'high', label: 'High (~70%)' },
                    { value: 'extreme', label: 'Extreme (~85%)' },
                  ]}
                />
              </Card>
              <Card>
                <label className="block text-sm font-medium mb-3">Target LLM</label>
                <LLMSelector value={provider} onChange={setProvider} />
              </Card>
            </>
          )}

          <Button
            variant="gradient"
            className="w-full"
            disabled={!file || extracting || compressing}
            loading={mode === 'extract' ? extracting : compressing}
            onClick={mode === 'extract' ? handleExtract : handleExtractAndCompress}
            leftIcon={
              !extracting && !compressing
                ? mode === 'extract'
                  ? <ScanText className="w-4 h-4" />
                  : <Sparkles className="w-4 h-4" />
                : undefined
            }
          >
            {mode === 'extract'
              ? extracting ? 'Extracting…' : 'Extract Text'
              : compressing ? 'Processing…' : 'Extract & Compress'}
          </Button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {(extracting || compressing) && !extractResult && !compressResult && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-card p-8 text-center">
              <CenteredSpinner size="md" />
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">
                {compressing
                  ? 'Extracting text, then running compression pipeline…'
                  : 'Running OCR (this can take a few seconds for larger images)…'}
              </p>
            </div>
          </motion.div>
        )}

        {extractResult && (
          <motion.div
            key="extract"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Words"
                value={formatNumber(extractResult.words)}
                icon={FileText}
                iconColor="text-violet-400"
              />
              <StatCard
                label="Confidence"
                value={`${Math.round(extractResult.confidence)}%`}
                icon={Eye}
                iconColor={extractResult.confidence > 80 ? 'text-emerald-400' : 'text-amber-400'}
                delay={0.05}
              />
              <StatCard
                label="Vision Tokens Avoided"
                value={formatNumber(extractResult.savings.estimatedVisionTokens)}
                icon={TrendingDown}
                iconColor="text-red-400"
                delay={0.1}
              />
              <StatCard
                label="Text Tokens"
                value={formatNumber(extractResult.savings.extractedTextTokens)}
                icon={Zap}
                iconColor="text-cyan-400"
                delay={0.15}
              />
            </div>

            <Card padding="lg">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ScanText className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-semibold">Extracted Text</h3>
                  <Badge variant={extractResult.confidence > 80 ? 'success' : 'warning'}>
                    {Math.round(extractResult.confidence)}% confidence
                  </Badge>
                  {extractResult.hasLowConfidenceRegions && (
                    <Badge variant="warning">Review recommended</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => copyText(extractResult.text)}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={() =>
                      downloadText(
                        extractResult.text,
                        extractResult.filename.replace(/\.[^.]+$/, '') + '.txt'
                      )
                    }
                  >
                    Download
                  </Button>
                  <Button
                    variant="gradient"
                    size="sm"
                    leftIcon={<Minimize2 className="w-3.5 h-3.5" />}
                    onClick={() => useInCompress(extractResult.text)}
                  >
                    Compress
                  </Button>
                </div>
              </div>
              <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-96 overflow-auto whitespace-pre-wrap border border-[hsl(var(--border))]">
                {extractResult.text || '(no text detected)'}
              </pre>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                Processing took {extractResult.processingTimeMs}ms • Language: {extractResult.language}
              </p>
            </Card>

            <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-l-emerald-400">
              <TrendingDown className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  You just saved ~{formatNumber(extractResult.savings.estimatedVisionTokens - extractResult.savings.extractedTextTokens)} tokens
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  That's a <strong className="text-emerald-400">{extractResult.savings.tokenReductionPercent}% reduction</strong>{' '}
                  vs. sending this image directly to a vision model. Now compress the text for even more savings.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {compressResult && (
          <motion.div
            key="compress"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Vision Tokens Avoided"
                value={formatNumber(compressResult.ocr.savings.estimatedVisionTokens)}
                icon={TrendingDown}
                iconColor="text-red-400"
              />
              <StatCard
                label="After OCR"
                value={formatNumber(compressResult.compression.originalTokens)}
                icon={ScanText}
                iconColor="text-amber-400"
                delay={0.05}
              />
              <StatCard
                label="After Compression"
                value={formatNumber(compressResult.compression.compressedTokens)}
                icon={Zap}
                iconColor="text-emerald-400"
                delay={0.1}
              />
              <StatCard
                label="Total Reduction"
                value={`${Math.round(
                  (1 - compressResult.compression.compressedTokens /
                    Math.max(compressResult.ocr.savings.estimatedVisionTokens, 1)) * 100
                )}%`}
                icon={Sparkles}
                iconColor="text-violet-400"
                delay={0.15}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="warning">
                    Extracted ({formatNumber(compressResult.compression.originalTokens)} tokens)
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => copyText(compressResult.ocr.text)}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
                  {compressResult.ocr.text}
                </pre>
              </Card>

              <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="success">
                    Compressed ({formatNumber(compressResult.compression.compressedTokens)} tokens)
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Copy className="w-3.5 h-3.5" />}
                      onClick={() => copyText(compressResult.compression.compressedText)}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      onClick={() =>
                        downloadText(
                          compressResult.compression.compressedText,
                          compressResult.ocr.filename.replace(/\.[^.]+$/, '') + '-compressed.txt'
                        )
                      }
                    >
                      Download
                    </Button>
                  </div>
                </div>
                <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
                  {compressResult.compression.compressedText}
                </pre>
              </Card>
            </div>

            <div className="glass-card p-4 flex items-center gap-3 border-l-4 border-l-emerald-400">
              <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">
                  End-to-end token reduction: {formatNumber(compressResult.totalSavings.totalTokenReduction)} tokens
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Instead of {formatNumber(compressResult.ocr.savings.estimatedVisionTokens)} vision tokens for the image,
                  you now have {formatNumber(compressResult.compression.compressedTokens)} text tokens ready to send.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
