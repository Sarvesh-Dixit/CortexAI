import { useState } from 'react';
import { GitCompare, Code2, Zap } from 'lucide-react';
import { PageHeader } from '../components/shared';
import { Badge } from '../components/ui';
import { cn } from '../lib/utils';
import BenchmarkPanel from './playground/BenchmarkPanel';
import ApiExplorerPanel from './playground/ApiExplorerPanel';

type Mode = 'benchmark' | 'explorer';

export default function PlaygroundPage() {
  const [mode, setMode] = useState<Mode>('benchmark');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Playground"
        description={
          mode === 'benchmark'
            ? 'Benchmark prompt compression against real LLMs with parallel inference'
            : 'Test API endpoints and generate production-ready code snippets'
        }
        actions={
          <Badge variant="primary">
            <Code2 className="w-3 h-3 mr-1 inline" />
            Developer Tool
          </Badge>
        }
      />

      {/* Mode switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('benchmark')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            mode === 'benchmark'
              ? 'gradient-button text-white'
              : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          )}
        >
          <GitCompare className="w-4 h-4" />
          Benchmark
        </button>
        <button
          onClick={() => setMode('explorer')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            mode === 'explorer'
              ? 'gradient-button text-white'
              : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          )}
        >
          <Zap className="w-4 h-4" />
          API Explorer
        </button>
      </div>

      {mode === 'benchmark' ? <BenchmarkPanel /> : <ApiExplorerPanel />}
    </div>
  );
}
