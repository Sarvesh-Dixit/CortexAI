/**
 * Compression Agent
 * 
 * This is the ONLY agent allowed to rewrite content.
 * 
 * Responsibilities:
 * - Compress prompt
 * - Reduce redundancy
 * - Rewrite sentences
 * - Maintain semantic meaning
 * - Preserve important information
 * - Target: 70% token reduction
 * 
 * Uses intelligence gathered from all previous agents to make
 * informed compression decisions.
 */

import { AgentNode, WorkflowState, CompressionLevel } from '../types';

const COMPRESSION_TARGETS: Record<CompressionLevel, number> = {
  low: 0.30,
  medium: 0.50,
  high: 0.70,
  extreme: 0.85,
};

export class CompressionNode implements AgentNode {
  name = 'compression';

  shouldExecute(_state: WorkflowState): boolean {
    return true;
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const target = COMPRESSION_TARGETS[state.compressionLevel];
    const compressed = this.compress(state, target);

    return {
      ...state,
      compressedText: compressed,
    };
  }

  private compress(state: WorkflowState, target: number): string {
    let text = state.processedText;

    // Stage 1: Remove boilerplate (informed by boilerplate agent)
    text = this.removeBoilerplate(text, state, target);

    // Stage 2: Remove duplicates (informed by duplicate detection agent)
    text = this.removeDuplicates(text, state, target);

    // Stage 3: Handle document-type-specific compression
    text = this.applyTypeSpecificCompression(text, state, target);

    // Stage 4: Apply semantic compression (filler phrases, verbose patterns)
    text = this.applySemanticCompression(text, target);

    // Stage 5: Importance-aware sentence filtering
    text = this.filterByImportance(text, state, target);

    // Stage 6: Token optimization (contractions, abbreviations)
    text = this.optimizeTokens(text, target);

    // Final cleanup
    text = text.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

    return text;
  }

  private removeBoilerplate(text: string, state: WorkflowState, target: number): string {
    if (!state.boilerplateResult || target < 0.3) return text;

    // Remove candidates sorted by position (reverse to maintain indices)
    const candidates = [...state.boilerplateResult.removalCandidates]
      .sort((a, b) => b.start - a.start);

    let result = text;
    for (const candidate of candidates) {
      if (candidate.start >= 0 && candidate.end <= result.length) {
        const before = result.slice(0, candidate.start);
        const after = result.slice(candidate.end);
        result = before + after;
      }
    }

    return result;
  }

  private removeDuplicates(text: string, state: WorkflowState, target: number): string {
    if (!state.duplicateResult || target < 0.3) return text;

    const sentences = text.split(/(?<=[.!?\n])\s*/);
    const duplicateIndices = new Set(
      state.duplicateResult.duplicateSentences.map(d => d.duplicate)
    );

    // For code, also remove duplicate imports
    if (state.documentType === 'code' && state.duplicateResult.duplicateImports.length > 0) {
      for (const dupImport of state.duplicateResult.duplicateImports) {
        const idx = text.lastIndexOf(dupImport);
        if (idx > 0) {
          text = text.slice(0, idx) + text.slice(idx + dupImport.length);
        }
      }
    }

    if (duplicateIndices.size > 0) {
      const filtered = sentences.filter((_, i) => !duplicateIndices.has(i));
      return filtered.join(' ');
    }

    return text;
  }

  private applyTypeSpecificCompression(text: string, state: WorkflowState, target: number): string {
    switch (state.documentType) {
      case 'code':
        return this.compressCode(text, state, target);
      case 'logs':
        return this.compressLogs(text, state, target);
      case 'json':
        return this.compressJson(text, target);
      case 'csv':
        return this.compressCsv(text, target);
      case 'email':
        return this.compressEmail(text, target);
      case 'legal_document':
        return this.compressLegal(text, target);
      case 'markdown':
        return this.compressMarkdown(text, target);
      default:
        return text;
    }
  }

  private compressCode(text: string, state: WorkflowState, target: number): string {
    let result = text;

    if (state.codeAnalysisResult) {
      // Remove removable comments
      if (target >= 0.4) {
        const removableComments = state.codeAnalysisResult.comments
          .filter(c => c.removable)
          .sort((a, b) => b.line - a.line);

        const lines = result.split('\n');
        for (const comment of removableComments) {
          if (comment.line < lines.length) {
            const line = lines[comment.line].trim();
            if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
              lines[comment.line] = '';
            }
          }
        }
        result = lines.filter(l => l !== '' || true).join('\n');
      }

      // Remove excessive blank lines
      if (target >= 0.3) {
        result = result.replace(/\n{3,}/g, '\n\n');
      }

      // Remove console/debug logs for high compression
      if (target >= 0.6) {
        result = result.replace(/^\s*(console\.(log|info|debug|warn)|print|System\.out\.println)\s*\(.+\);?\s*$/gm, '');
      }
    }

    return result;
  }

  private compressLogs(text: string, state: WorkflowState, target: number): string {
    if (!state.logAnalysisResult) return text;

    const lines = text.split('\n');
    const result: string[] = [];

    // Group repeated messages
    const repeated = new Map<string, number>();
    for (const rep of state.logAnalysisResult.repeatedMessages) {
      const normalized = rep.message
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      repeated.set(normalized, rep.count);
    }

    const seen = new Set<string>();
    for (const line of lines) {
      const normalized = line
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);

      // Always keep unique errors
      if (/\b(ERROR|FATAL|EXCEPTION)\b/i.test(line)) {
        result.push(line);
        continue;
      }

      // For repeated messages, keep first occurrence and add count
      if (repeated.has(normalized)) {
        if (!seen.has(normalized)) {
          seen.add(normalized);
          const count = repeated.get(normalized)!;
          result.push(`${line} [repeated ${count}x]`);
        }
        continue;
      }

      // For target >= 0.7, only keep errors and warnings
      if (target >= 0.7) {
        if (/\b(ERROR|WARN|FATAL)\b/i.test(line)) {
          result.push(line);
        }
      } else if (target >= 0.5) {
        // Skip DEBUG and TRACE for medium compression
        if (!/\b(DEBUG|TRACE)\b/i.test(line)) {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private compressJson(text: string, target: number): string {
    try {
      const parsed = JSON.parse(text);
      if (target >= 0.7) {
        const truncated = this.truncateJson(parsed, 3);
        return JSON.stringify(truncated);
      } else if (target >= 0.5) {
        return JSON.stringify(parsed); // Minify
      }
      return JSON.stringify(parsed, null, 1); // Reduced indent
    } catch {
      return text;
    }
  }

  private truncateJson(obj: unknown, maxDepth: number, depth = 0): unknown {
    if (depth >= maxDepth) return '[...]';
    if (Array.isArray(obj)) {
      if (obj.length > 3) {
        return [...obj.slice(0, 2).map(i => this.truncateJson(i, maxDepth, depth + 1)), `[...${obj.length - 2} more]`];
      }
      return obj.map(i => this.truncateJson(i, maxDepth, depth + 1));
    }
    if (obj !== null && typeof obj === 'object') {
      const entries = Object.entries(obj);
      const result: Record<string, unknown> = {};
      for (const [k, v] of entries.slice(0, 8)) {
        result[k] = this.truncateJson(v, maxDepth, depth + 1);
      }
      if (entries.length > 8) result['...'] = `${entries.length - 8} more`;
      return result;
    }
    if (typeof obj === 'string' && obj.length > 100) return obj.slice(0, 80) + '...';
    return obj;
  }

  private compressCsv(text: string, target: number): string {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length <= 5) return text;

    const sampleSize = target >= 0.7 ? 3 : target >= 0.5 ? 5 : 10;
    return [
      lines[0],
      ...lines.slice(1, sampleSize + 1),
      `[...${lines.length - sampleSize - 1} more rows]`,
    ].join('\n');
  }

  private compressEmail(text: string, target: number): string {
    let result = text;

    // Remove quoted replies
    if (target >= 0.5) {
      result = result.replace(/^>.*$/gm, '').replace(/\n{2,}/g, '\n\n');
    }

    // Remove signatures
    if (target >= 0.4) {
      result = result.replace(/\n--\s*\n[\s\S]*$/, '');
    }

    return result;
  }

  private compressLegal(text: string, target: number): string {
    let result = text;

    const boilerplate = [
      /hereinafter referred to as\s*/gi,
      /notwithstanding anything to the contrary\s*/gi,
      /for the avoidance of doubt\s*/gi,
      /without limiting the generality of the foregoing\s*/gi,
      /to the fullest extent permitted by (applicable )?law\s*/gi,
    ];

    if (target >= 0.5) {
      for (const pattern of boilerplate) {
        result = result.replace(pattern, '');
      }
    }

    return result;
  }

  private compressMarkdown(text: string, target: number): string {
    let result = text;

    // Summarize code blocks for high compression
    if (target >= 0.7) {
      result = result.replace(/```[\w]*\n([\s\S]*?)```/g, (_, content) => {
        const lines = content.split('\n').filter((l: string) => l.trim()).length;
        return `\`[${lines}-line code block]\``;
      });
    }

    return result;
  }

  private applySemanticCompression(text: string, target: number): string {
    if (target < 0.4) return text;

    let result = text;

    // Phrase replacements
    const replacements: Array<[RegExp, string]> = [
      [/in order to/gi, 'to'],
      [/due to the fact that/gi, 'because'],
      [/in the event that/gi, 'if'],
      [/at the present time/gi, 'now'],
      [/at this point in time/gi, 'now'],
      [/with regard to/gi, 'about'],
      [/a large number of/gi, 'many'],
      [/the vast majority of/gi, 'most'],
      [/has the ability to/gi, 'can'],
      [/is able to/gi, 'can'],
      [/in light of the fact that/gi, 'since'],
      [/despite the fact that/gi, 'although'],
      [/for the purpose of/gi, 'to'],
      [/take into consideration/gi, 'consider'],
      [/make a decision/gi, 'decide'],
      [/it is necessary to/gi, 'must'],
      [/on a daily basis/gi, 'daily'],
      [/each and every/gi, 'every'],
      [/first and foremost/gi, 'first'],
    ];

    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }

    // Remove filler words for medium+ compression
    if (target >= 0.5) {
      const fillers = /\b(basically|essentially|actually|literally|obviously|clearly|certainly|definitely|undoubtedly|honestly|frankly)\b\s*/gi;
      result = result.replace(fillers, '');
    }

    return result;
  }

  private filterByImportance(text: string, state: WorkflowState, target: number): string {
    if (target < 0.6 || state.importanceScores.length === 0) return text;

    const sentences = text.split(/(?<=[.!?\n])\s*/).filter(s => s.trim().length > 5);
    if (sentences.length <= 3) return text;

    // Determine threshold based on compression target
    const threshold = target >= 0.8 ? 0.5 : target >= 0.7 ? 0.4 : 0.3;

    const kept: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const score = state.importanceScores[i]?.score ?? 0.5;
      if (score >= threshold) {
        kept.push(sentences[i]);
      }
    }

    // Always keep at least 20% of sentences
    if (kept.length < sentences.length * 0.2) {
      const sorted = state.importanceScores
        .map((s, i) => ({ ...s, sentenceIndex: i }))
        .sort((a, b) => b.score - a.score);

      const minKeep = Math.ceil(sentences.length * 0.2);
      const topIndices = new Set(sorted.slice(0, minKeep).map(s => s.sentenceIndex));

      return sentences.filter((_, i) => topIndices.has(i)).join(' ');
    }

    return kept.join(' ');
  }

  private optimizeTokens(text: string, target: number): string {
    if (target < 0.5) return text;

    let result = text;

    // Contractions
    const contractions: Array<[RegExp, string]> = [
      [/\bdo not\b/gi, "don't"],
      [/\bcannot\b/gi, "can't"],
      [/\bwill not\b/gi, "won't"],
      [/\bshould not\b/gi, "shouldn't"],
      [/\bwould not\b/gi, "wouldn't"],
      [/\bcould not\b/gi, "couldn't"],
      [/\bdoes not\b/gi, "doesn't"],
      [/\bis not\b/gi, "isn't"],
      [/\bare not\b/gi, "aren't"],
      [/\bit is\b/gi, "it's"],
      [/\bthat is\b/gi, "that's"],
    ];

    for (const [pattern, replacement] of contractions) {
      result = result.replace(pattern, replacement);
    }

    // Abbreviations for high compression
    if (target >= 0.7) {
      const abbreviations: Record<string, string> = {
        'approximately': 'approx',
        'configuration': 'config',
        'documentation': 'docs',
        'implementation': 'impl',
        'authentication': 'auth',
        'environment': 'env',
        'application': 'app',
        'information': 'info',
        'development': 'dev',
        'repository': 'repo',
        'directory': 'dir',
        'parameter': 'param',
        'for example': 'e.g.',
        'that is to say': 'i.e.',
      };

      for (const [full, abbr] of Object.entries(abbreviations)) {
        result = result.replace(new RegExp(`\\b${full}\\b`, 'gi'), abbr);
      }
    }

    return result;
  }
}
