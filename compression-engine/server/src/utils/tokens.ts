/**
 * Token estimation utilities.
 * Uses approximation: ~4 characters per token for English text.
 * For code, uses ~3.5 characters per token.
 */

export function estimateTokens(text: string, type: string = 'text'): number {
  if (!text) return 0;
  const charsPerToken = type === 'code' ? 3.5 : 4;
  return Math.ceil(text.length / charsPerToken);
}

export function estimateCost(tokens: number, provider: string = 'openai'): number {
  const costPer1kTokens: Record<string, number> = {
    openai: 0.03,
    gemini: 0.0025,
    claude: 0.025,
    llama: 0.001,
    deepseek: 0.002,
    mistral: 0.008,
    ollama: 0.0,
  };
  const rate = costPer1kTokens[provider] || 0.03;
  return (tokens / 1000) * rate;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export function countCharacters(text: string): number {
  return text.length;
}

export function detectDocumentType(text: string, filename?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      py: 'python',
      js: 'javascript',
      ts: 'typescript',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      md: 'markdown',
      json: 'json',
      csv: 'csv',
      txt: 'text',
      pdf: 'pdf',
      docx: 'docx',
      log: 'logs',
    };
    if (ext && typeMap[ext]) return typeMap[ext];
  }

  if (text.includes('def ') && text.includes(':') && text.includes('import ')) return 'python';
  if (text.includes('function ') || text.includes('const ') || text.includes('=>')) return 'javascript';
  if (text.includes('public class ') || text.includes('private ')) return 'java';
  if (text.includes('#include') && text.includes('int main')) return 'cpp';
  if (text.startsWith('{') || text.startsWith('[')) return 'json';
  if (text.includes('# ') && text.includes('## ')) return 'markdown';
  if (text.includes('[ERROR]') || text.includes('[INFO]') || text.includes('[WARN]')) return 'logs';
  if (text.includes('Subject:') && text.includes('From:')) return 'email';
  if (text.includes('WHEREAS') || text.includes('hereby') || text.includes('pursuant')) return 'legal';

  return 'text';
}

export function detectLanguage(text: string): string {
  const indicators: Record<string, string[]> = {
    python: ['def ', 'import ', 'class ', 'self.', 'elif', '__init__'],
    javascript: ['function ', 'const ', 'let ', 'var ', '=>', 'require('],
    typescript: ['interface ', 'type ', ': string', ': number', 'as '],
    java: ['public class', 'private ', 'System.out', 'void '],
    cpp: ['#include', 'std::', 'cout', 'int main'],
  };

  for (const [lang, patterns] of Object.entries(indicators)) {
    const matches = patterns.filter(p => text.includes(p)).length;
    if (matches >= 2) return lang;
  }

  return 'english';
}
