export interface TextAnalysis {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  avgWordsPerSentence: number;
  readabilityScore: number;
  keyPhrases: string[];
  redundancyLevel: number;
}

export class TextAnalyzer {
  analyze(text: string): TextAnalysis {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const readabilityScore = this.calculateReadability(words, sentences);
    const keyPhrases = this.extractKeyPhrases(text);
    const redundancyLevel = this.calculateRedundancy(text);

    return {
      words: words.length,
      characters: text.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgWordsPerSentence,
      readabilityScore,
      keyPhrases,
      redundancyLevel,
    };
  }

  private calculateReadability(words: string[], sentences: string[]): number {
    if (sentences.length === 0 || words.length === 0) return 0;
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllables = words.reduce((sum, w) => sum + this.countSyllables(w), 0) / words.length;
    // Flesch Reading Ease approximation
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables);
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    const vowels = word.match(/[aeiouy]+/g);
    let count = vowels ? vowels.length : 1;
    if (word.endsWith('e')) count--;
    return Math.max(1, count);
  }

  private extractKeyPhrases(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'because',
      'but', 'and', 'or', 'if', 'while', 'although', 'this', 'that', 'these',
      'those', 'it', 'its', 'i', 'we', 'you', 'he', 'she', 'they', 'what',
      'which', 'who', 'whom',
    ]);

    const wordFreq: Record<string, number> = {};
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    for (const word of words) {
      const clean = word.replace(/[^a-z0-9]/g, '');
      if (clean.length > 3 && !stopWords.has(clean)) {
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      }
    }

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  private calculateRedundancy(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length <= 1) return 0;

    let redundantPairs = 0;
    const totalPairs = sentences.length * (sentences.length - 1) / 2;

    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const similarity = this.sentenceSimilarity(sentences[i], sentences[j]);
        if (similarity > 0.6) redundantPairs++;
      }
    }

    return totalPairs > 0 ? redundantPairs / totalPairs : 0;
  }

  private sentenceSimilarity(s1: string, s2: string): number {
    const words1 = new Set(s1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(s2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) intersection++;
    }

    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}
