import { useMemo } from 'react';
import { cn } from '../../lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer. Handles headers, bold, italic, code,
 * lists, links, and paragraphs. Suitable for preview and documentation.
 */
export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className={cn(
        'prose prose-invert prose-sm max-w-none',
        '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
        '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2',
        '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1',
        '[&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2',
        '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-2 [&_ul]:text-sm',
        '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-2 [&_ol]:text-sm',
        '[&_li]:mb-1',
        '[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[hsl(var(--secondary))] [&_code]:text-xs [&_code]:font-mono',
        '[&_pre]:bg-[hsl(var(--input))] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2',
        '[&_a]:text-[hsl(var(--primary))] [&_a]:underline',
        '[&_strong]:font-semibold',
        '[&_em]:italic',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(var(--primary))] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[hsl(var(--muted-foreground))]',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (must be first)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  });

  // Headers
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/(?:^[-*]\s+.+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
    return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  });

  // Ordered lists
  html = html.replace(/(?:^\d+\.\s+.+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map((l) => l.replace(/^\d+\.\s+/, ''));
    return `<ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
  });

  // Paragraphs (double newlines)
  html = html.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}
