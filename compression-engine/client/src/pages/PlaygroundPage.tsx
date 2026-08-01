import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Play, Code2, ArrowRightLeft, Terminal, FileJson, ChevronRight,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store';
import { formatCurrency, cn } from '../lib/utils';
import { PageHeader, LLMSelector, CodeViewer } from '../components/shared';
import { Card, Button, Select, Tabs, Badge, Switch } from '../components/ui';

interface Endpoint {
  id: string;
  method: 'POST' | 'GET';
  path: string;
  title: string;
  description: string;
  supportsLlm: boolean;
  buildBody: (state: PlaygroundState) => Record<string, unknown> | null;
}

interface PlaygroundState {
  text: string;
  level: string;
  provider: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'compress',
    method: 'POST',
    path: '/api/compression/compress',
    title: 'Compress',
    description: 'Run the full multi-agent pipeline on a prompt',
    supportsLlm: true,
    buildBody: (s) => ({ text: s.text, level: s.level, llmProvider: s.provider }),
  },
  {
    id: 'analyze',
    method: 'POST',
    path: '/api/compression/analyze',
    title: 'Analyze',
    description: 'Analyze text without compressing',
    supportsLlm: false,
    buildBody: (s) => ({ text: s.text }),
  },
  {
    id: 'compare',
    method: 'POST',
    path: '/api/compression/compare',
    title: 'Compare Levels',
    description: 'Compress at all four levels and compare',
    supportsLlm: false,
    buildBody: (s) => ({ text: s.text, llmProvider: s.provider }),
  },
  {
    id: 'chat',
    method: 'POST',
    path: '/api/llm/chat',
    title: 'LLM Chat',
    description: 'Send a prompt directly to an LLM provider',
    supportsLlm: true,
    buildBody: (s) => ({ prompt: s.text, provider: s.provider }),
  },
  {
    id: 'llm-compress',
    method: 'POST',
    path: '/api/llm/compress',
    title: 'Compress & Forward',
    description: 'Compress then send to LLM in one call',
    supportsLlm: true,
    buildBody: (s) => ({ text: s.text, level: s.level, provider: s.provider }),
  },
];

const SAMPLE_PROMPTS: Record<string, string> = {
  simple: 'The quick brown fox jumps over the lazy dog. This is a simple test.',
  verbose:
    "It is important to note that, in order to understand the situation, we should first take into consideration the fact that the compression engine has the ability to reduce token usage. Basically, due to the fact that we use a multi-agent pipeline, the system is able to preserve semantic meaning while removing redundant content. It goes without saying that this results in significant cost savings.",
  code: `function calculateSum(a, b) {
  // This function adds two numbers
  // and returns the result
  return a + b;
}

// Test the function
console.log(calculateSum(2, 3));
console.log(calculateSum(5, 7));`,
};

export default function PlaygroundPage() {
  const [endpointId, setEndpointId] = useState<string>('compress');
  const [text, setText] = useState('');
  const [level, setLevel] = useState('medium');
  const [provider, setProvider] = useState('openai');
  const [response, setResponse] = useState<any>(null);
  const [responseMeta, setResponseMeta] = useState<{ status: number; timeMs: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendToLlm, setSendToLlm] = useState(false);
  const [llmResponses, setLlmResponses] = useState<{
    original: { text: string; latency: number; cost: number } | null;
    compressed: { text: string; latency: number; cost: number } | null;
  } | null>(null);

  const endpoint = ENDPOINTS.find((e) => e.id === endpointId) || ENDPOINTS[0];
  const state: PlaygroundState = { text, level, provider };
  const requestBody = endpoint.buildBody(state);

  const canRun = text.trim().length > 0;

  const handleRun = async () => {
    if (!canRun) {
      toast.error('Enter a prompt first');
      return;
    }
    setLoading(true);
    setResponse(null);
    setResponseMeta(null);
    setLlmResponses(null);

    const start = Date.now();
    try {
      const { data, status } = await api.request({
        method: endpoint.method,
        url: endpoint.path.replace(/^\/api/, ''),
        data: requestBody,
      });
      const elapsed = Date.now() - start;
      setResponse(data);
      setResponseMeta({ status, timeMs: elapsed });
      toast.success(`${endpoint.method} ${endpoint.path} → ${status} in ${elapsed}ms`);

      // If user enabled Send-to-LLM comparison for /compress endpoints,
      // send both original and compressed to the LLM and compare responses.
      if (sendToLlm && endpoint.supportsLlm && endpoint.id === 'compress' && data?.data?.compressedText) {
        await runLlmComparison(text, data.data.compressedText, provider);
      }
    } catch (error: any) {
      const elapsed = Date.now() - start;
      setResponse(error.response?.data || { error: { message: error.message } });
      setResponseMeta({ status: error.response?.status || 0, timeMs: elapsed });
      toast.error(error.response?.data?.error?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const runLlmComparison = async (original: string, compressed: string, prov: string) => {
    try {
      const [origRes, compRes] = await Promise.all([
        api.post('/llm/chat', { prompt: original, provider: prov }),
        api.post('/llm/chat', { prompt: compressed, provider: prov }),
      ]);
      setLlmResponses({
        original: {
          text: origRes.data.data.response,
          latency: origRes.data.data.latencyMs,
          cost: origRes.data.data.totalCost,
        },
        compressed: {
          text: compRes.data.data.response,
          latency: compRes.data.data.latencyMs,
          cost: compRes.data.data.totalCost,
        },
      });
    } catch (error) {
      toast.error('LLM comparison failed');
    }
  };

  const curlSnippet = useMemo(() => {
    const token = useAuthStore.getState().token;
    const base = window.location.origin;
    const body = requestBody ? JSON.stringify(requestBody, null, 2) : '';
    const lines: string[] = [
      `curl -X ${endpoint.method} '${base}${endpoint.path}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H 'Authorization: Bearer ${token ? token.slice(0, 20) + '…' : '<YOUR_TOKEN>'}' \\`,
    ];
    if (body) {
      lines.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
    }
    return lines.join('\n');
  }, [endpoint, requestBody]);

  const jsSnippet = useMemo(() => {
    const body = requestBody ? JSON.stringify(requestBody, null, 2) : 'null';
    return `const response = await fetch('${endpoint.path}', {
  method: '${endpoint.method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <YOUR_TOKEN>',
  },
  body: JSON.stringify(${body}),
});
const data = await response.json();
console.log(data);`;
  }, [endpoint, requestBody]);

  const pythonSnippet = useMemo(() => {
    const body = requestBody ? JSON.stringify(requestBody, null, 2) : 'None';
    return `import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${endpoint.path}',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <YOUR_TOKEN>',
    },
    json=${body},
)
print(response.json())`;
  }, [endpoint, requestBody]);

  const insertSample = (key: keyof typeof SAMPLE_PROMPTS) => {
    setText(SAMPLE_PROMPTS[key]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Playground"
        description="Test API endpoints, generate code snippets, and compare LLM responses"
        actions={
          <Badge variant="primary">
            <Code2 className="w-3 h-3 mr-1 inline" />
            Developer Tool
          </Badge>
        }
      />

      {/* Endpoint Selector - Postman style */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-1.5">
          {ENDPOINTS.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setEndpointId(ep.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all',
                ep.id === endpointId
                  ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))]'
                  : 'border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 text-[hsl(var(--muted-foreground))]'
              )}
            >
              <span
                className={cn(
                  'font-mono font-bold text-[10px] px-1.5 py-0.5 rounded',
                  ep.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                )}
              >
                {ep.method}
              </span>
              <span className="font-medium">{ep.title}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex items-center gap-2 text-xs">
          <span className="font-mono text-[hsl(var(--muted-foreground))]">{endpoint.path}</span>
          <ChevronRight className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[hsl(var(--muted-foreground))]">{endpoint.description}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Request Body</label>
              <div className="flex gap-1 text-[10px]">
                <button
                  onClick={() => insertSample('simple')}
                  className="px-2 py-1 rounded bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70 transition-colors"
                >
                  Simple
                </button>
                <button
                  onClick={() => insertSample('verbose')}
                  className="px-2 py-1 rounded bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70 transition-colors"
                >
                  Verbose
                </button>
                <button
                  onClick={() => insertSample('code')}
                  className="px-2 py-1 rounded bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/70 transition-colors"
                >
                  Code
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your prompt to send to the API..."
              className="w-full h-40 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-all"
            />
          </Card>

          {/* Live Request Preview */}
          <Card>
            <label className="block text-sm font-medium mb-2">Request Payload</label>
            <CodeViewer
              code={JSON.stringify(requestBody, null, 2)}
              language="json"
              maxHeight="200px"
            />
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Card>
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
          </Card>

          <Card>
            <label className="block text-sm font-medium mb-3">Target LLM</label>
            <LLMSelector value={provider} onChange={setProvider} />
          </Card>

          {endpoint.supportsLlm && endpoint.id === 'compress' && (
            <Card>
              <Switch
                checked={sendToLlm}
                onChange={setSendToLlm}
                label="Send both prompts to LLM"
                description="Send original + compressed to the LLM and compare responses"
              />
            </Card>
          )}

          <Button
            variant="gradient"
            className="w-full"
            onClick={handleRun}
            disabled={!canRun || loading}
            loading={loading}
            leftIcon={!loading ? <Play className="w-4 h-4" /> : undefined}
          >
            {loading ? 'Sending...' : `${endpoint.method} ${endpoint.title}`}
          </Button>
        </div>
      </div>

      {/* Response + Code snippets */}
      <Tabs
        tabs={[
          {
            id: 'response',
            label: 'Response',
            icon: <FileJson className="w-3.5 h-3.5" />,
            content: (
              <>
                {responseMeta ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={responseMeta.status < 300 ? 'success' : 'error'}>
                        {responseMeta.status}
                      </Badge>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {responseMeta.timeMs}ms
                      </span>
                    </div>
                    <CodeViewer
                      code={JSON.stringify(response, null, 2)}
                      language="json"
                      maxHeight="500px"
                      filename="response.json"
                      allowDownload
                    />
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Run a request to see the response
                  </p>
                )}
              </>
            ),
          },
          {
            id: 'llm',
            label: 'LLM Comparison',
            icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
            content: (
              <>
                {llmResponses ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                        <Badge variant="error">Original prompt response</Badge>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {llmResponses.original?.latency}ms • {formatCurrency(llmResponses.original?.cost || 0)}
                        </span>
                      </div>
                      <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
                        {llmResponses.original?.text || 'No response'}
                      </pre>
                    </Card>
                    <Card>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="success">Compressed prompt response</Badge>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {llmResponses.compressed?.latency}ms • {formatCurrency(llmResponses.compressed?.cost || 0)}
                        </span>
                      </div>
                      <pre className="text-xs font-mono bg-[hsl(var(--input))] p-3 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
                        {llmResponses.compressed?.text || 'No response'}
                      </pre>
                    </Card>
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    Enable "Send both prompts to LLM" and run /compress to compare
                  </p>
                )}
              </>
            ),
          },
          {
            id: 'curl',
            label: 'cURL',
            icon: <Terminal className="w-3.5 h-3.5" />,
            content: (
              <CodeViewer code={curlSnippet} language="bash" maxHeight="400px" />
            ),
          },
          {
            id: 'js',
            label: 'JavaScript',
            icon: <Code2 className="w-3.5 h-3.5" />,
            content: (
              <CodeViewer code={jsSnippet} language="javascript" maxHeight="400px" />
            ),
          },
          {
            id: 'python',
            label: 'Python',
            icon: <Code2 className="w-3.5 h-3.5" />,
            content: (
              <CodeViewer code={pythonSnippet} language="python" maxHeight="400px" />
            ),
          },
        ]}
      />
    </div>
  );
}
