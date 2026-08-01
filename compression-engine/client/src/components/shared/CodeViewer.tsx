import { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CodeViewerProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  allowDownload?: boolean;
  className?: string;
}

export function CodeViewer({
  code,
  language,
  filename,
  showLineNumbers = false,
  maxHeight = '400px',
  allowDownload = false,
  className,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'code.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = code.split('\n');

  return (
    <div className={cn('border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-[hsl(var(--input))]', className)}>
      {(filename || language) && (
        <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            {filename && <span className="font-medium">{filename}</span>}
            {language && (
              <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--secondary))] uppercase text-[10px]">
                {language}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="p-1 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-[hsl(var(--secondary))] rounded transition-colors"
              title="Copy"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              )}
            </button>
          </div>
        </div>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        {showLineNumbers ? (
          <table className="w-full text-xs font-mono">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="text-[hsl(var(--muted-foreground))] pr-3 pl-3 py-0 text-right select-none w-10 border-r border-[hsl(var(--border))]/50">
                    {i + 1}
                  </td>
                  <td className="px-3 whitespace-pre">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="text-xs font-mono p-3 whitespace-pre-wrap break-all">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}
