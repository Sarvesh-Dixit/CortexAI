export interface RedundancyResult {
  text: string;
  removed: string[];
}

export class RedundancyRemover {
  remove(text: string, target: number): RedundancyResult {
    const removed: string[] = [];
    let result = text;

    // Remove repeated phrases
    result = this.removeRepeatedPhrases(result, removed);

    // Remove filler words
    if (target >= 0.3) {
      result = this.removeFillerWords(result, removed);
    }

    // Remove redundant adjectives/adverbs
    if (target >= 0.5) {
      result = this.removeRedundantModifiers(result, removed);
    }

    // Remove repeated information across paragraphs
    if (target >= 0.6) {
      result = this.removeRepeatedInformation(result, removed);
    }

    // Clean up resulting whitespace
    result = result.replace(/\s{2,}/g, ' ');
    result = result.replace(/\n{3,}/g, '\n\n');

    return { text: result.trim(), removed };
  }

  private removeRepeatedPhrases(text: string, removed: string[]): string {
    // Find phrases that appear more than twice
    const words = text.split(/\s+/);
    const phraseLength = 4;
    const phraseCounts = new Map<string, number>();

    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }

    let result = text;
    for (const [phrase, count] of phraseCounts) {
      if (count > 2 && phrase.length > 15) {
        // Keep first occurrence, remove subsequent ones
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let occurrence = 0;
        result = result.replace(regex, (match) => {
          occurrence++;
          if (occurrence > 1) {
            removed.push(match);
            return '';
          }
          return match;
        });
      }
    }

    return result;
  }

  private removeFillerWords(text: string, removed: string[]): string {
    const fillers = [
      /\b(very|really|quite|rather|somewhat|fairly|pretty much|sort of|kind of|a bit)\b/gi,
      /\b(just|simply|merely|only|basically|literally|actually|honestly|frankly)\b/gi,
      /\b(in fact|as a matter of fact|to be honest|truth be told)\b/gi,
    ];

    let result = text;
    let count = 0;

    for (const pattern of fillers) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
        result = result.replace(pattern, '');
      }
    }

    if (count > 0) {
      removed.push(`[${count} filler words removed]`);
    }

    return result;
  }

  private removeRedundantModifiers(text: string, removed: string[]): string {
    const redundantPairs = [
      /\b(completely|totally|entirely|absolutely)\s+(destroyed|eliminated|removed|finished|done)\b/gi,
      /\b(very|extremely|incredibly|remarkably)\s+(unique|perfect|dead|empty|full|complete)\b/gi,
      /\b(past|previous)\s+(history|experience)\b/gi,
      /\b(future)\s+(plans|goals)\b/gi,
      /\b(brief|short)\s+(summary|overview)\b/gi,
      /\b(free)\s+(gift)\b/gi,
      /\b(end)\s+(result)\b/gi,
      /\b(final)\s+(outcome|conclusion)\b/gi,
      /\b(unexpected)\s+(surprise)\b/gi,
      /\b(advance|prior)\s+(warning|notice)\b/gi,
    ];

    let result = text;
    let count = 0;

    for (const pattern of redundantPairs) {
      const matches = result.match(pattern);
      if (matches) {
        count += matches.length;
        result = result.replace(pattern, (_match, _adj, noun) => noun);
      }
    }

    if (count > 0) {
      removed.push(`[${count} redundant modifiers]`);
    }

    return result;
  }

  private removeRepeatedInformation(text: string, removed: string[]): string {
    const paragraphs = text.split(/\n\s*\n/);
    if (paragraphs.length <= 2) return text;

    const result: string[] = [];
    const seenConcepts = new Set<string>();
    let removedCount = 0;

    for (const paragraph of paragraphs) {
      const keyWords = paragraph
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 5)
        .slice(0, 10);

      const conceptKey = keyWords.sort().join(',');

      // Check if this paragraph's concepts significantly overlap with seen ones
      let isRedundant = false;
      for (const seen of seenConcepts) {
        const seenWords = new Set(seen.split(','));
        const overlapCount = keyWords.filter(w => seenWords.has(w)).length;
        if (keyWords.length > 0 && overlapCount / keyWords.length > 0.7) {
          isRedundant = true;
          break;
        }
      }

      if (isRedundant) {
        removedCount++;
      } else {
        seenConcepts.add(conceptKey);
        result.push(paragraph);
      }
    }

    if (removedCount > 0) {
      removed.push(`[${removedCount} redundant paragraphs]`);
    }

    return result.join('\n\n');
  }
}
