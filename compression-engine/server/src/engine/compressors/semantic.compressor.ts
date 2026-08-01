export interface SemanticResult {
  text: string;
  modifications: Array<{ original: string; modified: string }>;
}

export class SemanticCompressor {
  private fillerPhrases: string[] = [
    'it is important to note that',
    'it should be noted that',
    'it is worth mentioning that',
    'as a matter of fact',
    'in order to',
    'for the purpose of',
    'with regard to',
    'with respect to',
    'in the event that',
    'in the case of',
    'at the present time',
    'at this point in time',
    'due to the fact that',
    'in light of the fact that',
    'despite the fact that',
    'regardless of the fact that',
    'it goes without saying that',
    'needless to say',
    'as previously mentioned',
    'as stated earlier',
    'as discussed above',
    'as noted above',
    'basically',
    'essentially',
    'fundamentally',
    'actually',
    'literally',
    'obviously',
    'clearly',
    'certainly',
    'definitely',
    'undoubtedly',
    'in my opinion',
    'i think that',
    'i believe that',
    'it seems to me that',
    'from my perspective',
    'in conclusion',
    'to summarize',
    'to sum up',
    'all things considered',
    'taking everything into account',
    'on the other hand',
    'having said that',
    'be that as it may',
    'for what it is worth',
  ];

  private replacements: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /in order to/gi, replacement: 'to' },
    { pattern: /for the purpose of/gi, replacement: 'to' },
    { pattern: /due to the fact that/gi, replacement: 'because' },
    { pattern: /in light of the fact that/gi, replacement: 'since' },
    { pattern: /despite the fact that/gi, replacement: 'although' },
    { pattern: /in the event that/gi, replacement: 'if' },
    { pattern: /at the present time/gi, replacement: 'now' },
    { pattern: /at this point in time/gi, replacement: 'now' },
    { pattern: /with regard to/gi, replacement: 'about' },
    { pattern: /with respect to/gi, replacement: 'regarding' },
    { pattern: /a large number of/gi, replacement: 'many' },
    { pattern: /a significant number of/gi, replacement: 'many' },
    { pattern: /the vast majority of/gi, replacement: 'most' },
    { pattern: /in close proximity to/gi, replacement: 'near' },
    { pattern: /has the ability to/gi, replacement: 'can' },
    { pattern: /is able to/gi, replacement: 'can' },
    { pattern: /make a decision/gi, replacement: 'decide' },
    { pattern: /take into consideration/gi, replacement: 'consider' },
    { pattern: /come to the conclusion/gi, replacement: 'conclude' },
    { pattern: /give an indication of/gi, replacement: 'indicate' },
    { pattern: /have a tendency to/gi, replacement: 'tend to' },
    { pattern: /it is necessary to/gi, replacement: 'must' },
    { pattern: /it is possible that/gi, replacement: 'possibly' },
    { pattern: /there is a possibility that/gi, replacement: 'possibly' },
    { pattern: /on a daily basis/gi, replacement: 'daily' },
    { pattern: /on a regular basis/gi, replacement: 'regularly' },
    { pattern: /in a timely manner/gi, replacement: 'promptly' },
    { pattern: /at this moment in time/gi, replacement: 'currently' },
    { pattern: /each and every/gi, replacement: 'every' },
    { pattern: /first and foremost/gi, replacement: 'first' },
    { pattern: /any and all/gi, replacement: 'all' },
    { pattern: /one and only/gi, replacement: 'only' },
    { pattern: /unless and until/gi, replacement: 'until' },
    { pattern: /null and void/gi, replacement: 'void' },
  ];

  compress(text: string, target: number): SemanticResult {
    const modifications: Array<{ original: string; modified: string }> = [];
    let result = text;

    // Apply phrase replacements
    for (const { pattern, replacement } of this.replacements) {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        modifications.push({
          original: matches[0],
          modified: replacement,
        });
      }
    }

    // Remove filler phrases for medium+ compression
    if (target >= 0.5) {
      result = this.removeFillerPhrases(result, modifications);
    }

    // Compress repetitive sentences
    if (target >= 0.6) {
      result = this.deduplicateSentences(result, modifications);
    }

    // Sentence simplification for high compression
    if (target >= 0.7) {
      result = this.simplifySentences(result, modifications);
    }

    return { text: result, modifications };
  }

  private removeFillerPhrases(text: string, modifications: Array<{ original: string; modified: string }>): string {
    let result = text;
    let removedCount = 0;

    for (const filler of this.fillerPhrases) {
      const regex = new RegExp(filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, '');
        removedCount++;
      }
    }

    if (removedCount > 0) {
      modifications.push({
        original: `[${removedCount} filler phrases]`,
        modified: '[removed]',
      });
    }

    // Clean up double spaces
    result = result.replace(/\s{2,}/g, ' ');
    result = result.replace(/\s+([.,;:!?])/g, '$1');

    return result;
  }

  private deduplicateSentences(text: string, modifications: Array<{ original: string; modified: string }>): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const seen = new Map<string, number>();
    const result: string[] = [];
    let removed = 0;

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const words = normalized.split(/\s+/);
      const key = words.slice(0, 8).join(' ');

      if (seen.has(key)) {
        const prevSimilarity = this.similarity(normalized, seen.get(key)!.toString());
        if (prevSimilarity > 0.7) {
          removed++;
          continue;
        }
      }

      seen.set(key, result.length);
      result.push(sentence);
    }

    if (removed > 0) {
      modifications.push({
        original: `[${removed} duplicate/similar sentences]`,
        modified: '[deduplicated]',
      });
    }

    return result.join(' ');
  }

  private simplifySentences(text: string, modifications: Array<{ original: string; modified: string }>): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const result: string[] = [];
    let simplified = 0;

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);

      if (words.length > 30) {
        // Split long sentence and keep key parts
        const clauses = sentence.split(/,\s+|;\s+|—\s+|\s+—\s+/);
        if (clauses.length > 2) {
          // Keep first and last clause (usually most important)
          const compressed = [clauses[0], clauses[clauses.length - 1]].join(', ');
          result.push(compressed);
          simplified++;
          continue;
        }
      }

      result.push(sentence);
    }

    if (simplified > 0) {
      modifications.push({
        original: `[${simplified} complex sentences]`,
        modified: '[simplified]',
      });
    }

    return result.join(' ');
  }

  private similarity(s1: string, s2: string): number {
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    let common = 0;
    for (const w of words1) {
      if (words2.has(w)) common++;
    }
    const union = words1.size + words2.size - common;
    return union > 0 ? common / union : 0;
  }
}
