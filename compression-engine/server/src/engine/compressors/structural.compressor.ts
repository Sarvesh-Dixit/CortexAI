export interface StructuralResult {
  text: string;
  modifications: Array<{ original: string; modified: string }>;
}

export class StructuralCompressor {
  compress(text: string, documentType: string, target: number): StructuralResult {
    switch (documentType) {
      case 'json':
        return this.compressJson(text, target);
      case 'markdown':
        return this.compressMarkdown(text, target);
      case 'logs':
        return this.compressLogs(text, target);
      case 'email':
        return this.compressEmail(text, target);
      case 'legal':
        return this.compressLegal(text, target);
      case 'csv':
        return this.compressCsv(text, target);
      default:
        return this.compressGenericText(text, target);
    }
  }

  private compressJson(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];

    try {
      const parsed = JSON.parse(text);
      let compressed: unknown;

      if (target >= 0.7) {
        compressed = this.deepTruncateJson(parsed, 3);
        modifications.push({ original: '[deep nested JSON]', modified: '[truncated to 3 levels]' });
      } else if (target >= 0.5) {
        compressed = this.deepTruncateJson(parsed, 5);
        modifications.push({ original: '[deep nested JSON]', modified: '[truncated to 5 levels]' });
      } else {
        compressed = parsed;
      }

      // Minify
      const result = JSON.stringify(compressed);
      modifications.push({ original: '[formatted JSON]', modified: '[minified]' });

      return { text: result, modifications };
    } catch {
      return { text, modifications: [] };
    }
  }

  private deepTruncateJson(obj: unknown, maxDepth: number, currentDepth = 0): unknown {
    if (currentDepth >= maxDepth) return '[...]';

    if (Array.isArray(obj)) {
      if (obj.length > 5) {
        const truncated = obj.slice(0, 3).map(item =>
          this.deepTruncateJson(item, maxDepth, currentDepth + 1)
        );
        truncated.push(`[...${obj.length - 3} more items]`);
        return truncated;
      }
      return obj.map(item => this.deepTruncateJson(item, maxDepth, currentDepth + 1));
    }

    if (obj !== null && typeof obj === 'object') {
      const entries = Object.entries(obj);
      const result: Record<string, unknown> = {};

      for (const [key, value] of entries.slice(0, 10)) {
        result[key] = this.deepTruncateJson(value, maxDepth, currentDepth + 1);
      }

      if (entries.length > 10) {
        result['...'] = `[${entries.length - 10} more keys]`;
      }

      return result;
    }

    if (typeof obj === 'string' && obj.length > 200) {
      return obj.slice(0, 100) + '...[truncated]';
    }

    return obj;
  }

  private compressMarkdown(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    const lines = text.split('\n');
    const result: string[] = [];

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block - summarize if high compression
          if (target >= 0.7 && codeBlockContent.length > 5) {
            result.push('```');
            result.push(`// [${codeBlockContent.length} lines of code]`);
            result.push('```');
            modifications.push({
              original: `[${codeBlockContent.length}-line code block]`,
              modified: '[summarized]',
            });
          } else {
            result.push('```');
            result.push(...codeBlockContent);
            result.push('```');
          }
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          result.push(line);
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Keep headers always
      if (line.startsWith('#')) {
        result.push(line);
        continue;
      }

      // Remove horizontal rules
      if (/^[-*_]{3,}$/.test(line.trim())) continue;

      // Keep list items but compress long ones
      if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
        if (line.length > 100 && target >= 0.6) {
          result.push(line.slice(0, 80) + '...');
          modifications.push({ original: line.slice(0, 40), modified: '[truncated list item]' });
        } else {
          result.push(line);
        }
        continue;
      }

      result.push(line);
    }

    return { text: result.join('\n'), modifications };
  }

  private compressLogs(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    const lines = text.split('\n');

    // Group similar log entries
    const groups = new Map<string, string[]>();

    for (const line of lines) {
      // Extract log pattern (remove timestamps and specific values)
      const pattern = line
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '[TIME]')
        .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, '[IP]')
        .replace(/\b[0-9a-f]{8,}\b/gi, '[ID]')
        .replace(/\d{3,}/g, '[NUM]');

      const key = pattern.slice(0, 60);

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(line);
    }

    const result: string[] = [];

    for (const [_pattern, entries] of groups) {
      if (entries.length > 3 && target >= 0.5) {
        result.push(entries[0]);
        result.push(`  ... [${entries.length - 1} similar entries]`);
        modifications.push({
          original: `[${entries.length} similar log entries]`,
          modified: '[grouped]',
        });
      } else {
        result.push(...entries);
      }
    }

    return { text: result.join('\n'), modifications };
  }

  private compressEmail(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    let result = text;

    // Remove email headers except Subject, From, To
    const headerPattern = /^((?!Subject:|From:|To:|Date:).)*:\s*.+$/gm;
    if (target >= 0.5) {
      const headers = result.match(headerPattern);
      if (headers) {
        result = result.replace(headerPattern, '');
        modifications.push({
          original: `[${headers.length} email headers]`,
          modified: '[removed non-essential headers]',
        });
      }
    }

    // Remove email signatures
    if (target >= 0.4) {
      const sigPattern = /--\s*\n[\s\S]*$/;
      if (sigPattern.test(result)) {
        result = result.replace(sigPattern, '');
        modifications.push({ original: '[email signature]', modified: '[removed]' });
      }
    }

    // Remove quoted replies
    if (target >= 0.6) {
      const quotedPattern = /^>.*$/gm;
      const quoted = result.match(quotedPattern);
      if (quoted && quoted.length > 3) {
        result = result.replace(quotedPattern, '');
        modifications.push({
          original: `[${quoted.length} quoted lines]`,
          modified: '[removed quoted replies]',
        });
      }
    }

    return { text: result.trim(), modifications };
  }

  private compressLegal(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    let result = text;

    // Remove boilerplate legal phrases
    if (target >= 0.5) {
      const boilerplate = [
        /hereinafter referred to as/gi,
        /notwithstanding anything to the contrary/gi,
        /subject to the terms and conditions/gi,
        /for the avoidance of doubt/gi,
        /without limiting the generality of the foregoing/gi,
        /to the fullest extent permitted by law/gi,
      ];

      let removed = 0;
      for (const pattern of boilerplate) {
        if (pattern.test(result)) {
          result = result.replace(pattern, '');
          removed++;
        }
      }

      if (removed > 0) {
        modifications.push({
          original: `[${removed} boilerplate phrases]`,
          modified: '[removed legal boilerplate]',
        });
      }
    }

    // Compress numbered sections if very long
    if (target >= 0.7) {
      const sections = result.split(/\n(?=\d+\.)/);
      if (sections.length > 20) {
        const compressed = sections.slice(0, 15);
        compressed.push(`\n[...${sections.length - 15} additional sections omitted]`);
        result = compressed.join('\n');
        modifications.push({
          original: `[${sections.length} legal sections]`,
          modified: '[kept first 15 sections]',
        });
      }
    }

    return { text: result, modifications };
  }

  private compressCsv(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length <= 10) return { text, modifications };

    const header = lines[0];
    let sampleSize: number;

    if (target >= 0.7) {
      sampleSize = 5;
    } else if (target >= 0.5) {
      sampleSize = 10;
    } else {
      sampleSize = 20;
    }

    const sample = lines.slice(1, sampleSize + 1);
    const result = [
      header,
      ...sample,
      `// [${lines.length - sampleSize - 1} more rows...]`,
    ].join('\n');

    modifications.push({
      original: `[${lines.length} CSV rows]`,
      modified: `[header + ${sampleSize} sample rows]`,
    });

    return { text: result, modifications };
  }

  private compressGenericText(text: string, target: number): StructuralResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    const paragraphs = text.split(/\n\s*\n/);

    if (paragraphs.length <= 3) return { text, modifications };

    // For high compression, keep only key paragraphs
    if (target >= 0.7 && paragraphs.length > 5) {
      const kept = [
        paragraphs[0], // intro
        ...paragraphs.slice(1, -1).filter((_p, i) => i % 3 === 0), // every 3rd paragraph
        paragraphs[paragraphs.length - 1], // conclusion
      ];

      modifications.push({
        original: `[${paragraphs.length} paragraphs]`,
        modified: `[${kept.length} key paragraphs retained]`,
      });

      return { text: kept.join('\n\n'), modifications };
    }

    return { text, modifications };
  }
}
