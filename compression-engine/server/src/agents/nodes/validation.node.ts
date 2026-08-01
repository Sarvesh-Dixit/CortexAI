/**
 * Validation Agent
 * 
 * Responsibilities:
 * - Compare: Original Prompt ↔ Compressed Prompt
 * - Measure: Semantic Similarity, Compression %, Estimated Accuracy, Reasoning Retention
 * - Only approve if quality threshold is met
 */

import { AgentNode, WorkflowState, ValidationResult } from '../types';

export class ValidationNode implements AgentNode {
  name = 'validation';

  shouldExecute(_state: WorkflowState): boolean {
    return true;
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const validation = this.validate(state.originalText, state.compressedText, state.compressionLevel);

    return {
      ...state,
      validation,
    };
  }

  private validate(original: string, compressed: string, level: string): ValidationResult {
    const semanticSimilarity = this.computeSemanticSimilarity(original, compressed);
    const compressionRatio = 1 - (compressed.length / original.length);
    const reasoningRetention = this.assessReasoningRetention(original, compressed);

    /*
     * Estimated accuracy weights:
     * - Reasoning retention gets higher weight (0.55) because preserving
     *   logical flow is more critical than preserving every word.
     * - Semantic similarity gets 0.45 because some term removal is expected
     *   and desirable during compression.
     */
    const estimatedAccuracy = (semanticSimilarity * 0.45) + (reasoningRetention * 0.55);

    /*
     * Compression-aware approval thresholds.
     * These are tuned to be realistic given that compression REMOVES content
     * by design. A perfect 100% similarity would only be possible without
     * any compression. The thresholds scale with how aggressive the compression is.
     */
    const thresholds: Record<string, number> = {
      low: 0.85,      // gentle compression, expect high fidelity
      medium: 0.78,   // balanced compression
      high: 0.72,     // aggressive but still coherent
      extreme: 0.65,  // maximum reduction, meaning distilled
    };

    const threshold = thresholds[level] || 0.75;
    const approved = estimatedAccuracy >= threshold;

    const issues: string[] = [];
    if (semanticSimilarity < 0.5) issues.push('Very low semantic similarity');
    if (reasoningRetention < 0.7) issues.push('Potential reasoning loss');
    if (compressionRatio < 0.05) issues.push('Minimal compression achieved');
    if (compressionRatio > 0.95) issues.push('Excessive compression may lose meaning');

    return {
      semanticSimilarity,
      compressionRatio: Math.max(0, Math.min(compressionRatio, 0.95)),
      estimatedAccuracy,
      reasoningRetention,
      approved,
      issues,
    };
  }

  private computeSemanticSimilarity(original: string, compressed: string): number {
    // Multi-factor semantic similarity assessment

    // Factor 1: Key term preservation
    const keyTermScore = this.keyTermPreservation(original, compressed);

    // Factor 2: Named entity preservation
    const entityScore = this.namedEntityPreservation(original, compressed);

    // Factor 3: Structural preservation
    const structureScore = this.structuralPreservation(original, compressed);

    // Factor 4: Semantic density (important content per token ratio)
    const densityScore = this.semanticDensity(original, compressed);

    // Weighted combination
    return (keyTermScore * 0.4) + (entityScore * 0.25) + (structureScore * 0.2) + (densityScore * 0.15);
  }

  private keyTermPreservation(original: string, compressed: string): number {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
      'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'and', 'or',
      'but', 'if', 'not', 'so', 'this', 'that', 'it', 'its',
    ]);

    const tokenize = (text: string): string[] =>
      text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stopWords.has(w));

    const originalWords = tokenize(original);
    const compressedWords = tokenize(compressed);

    if (originalWords.length === 0) return 1;

    // Build frequency maps
    const originalFreq = new Map<string, number>();
    for (const w of originalWords) originalFreq.set(w, (originalFreq.get(w) || 0) + 1);
    const compressedSet = new Set(compressedWords);

    /*
     * Weighted preservation:
     * - Each unique term contributes a weight based on rarity (1 / frequency)
     * - This rewards preserving rare, distinctive terms (names, technical concepts)
     * - And doesn't penalize removing repeated fluff
     */
    let totalWeight = 0;
    let preservedWeight = 0;

    for (const [term, freq] of originalFreq) {
      const rarityWeight = 1 / Math.sqrt(freq); // Rarer terms weighted higher
      totalWeight += rarityWeight;
      if (compressedSet.has(term)) {
        preservedWeight += rarityWeight;
      }
    }

    return totalWeight > 0 ? preservedWeight / totalWeight : 1;
  }

  private namedEntityPreservation(original: string, compressed: string): number {
    const extractEntities = (text: string): Set<string> => {
      const entities = new Set<string>();

      // Capitalized multi-word names
      const names = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
      if (names) names.forEach(n => entities.add(n.toLowerCase()));

      // Technical identifiers (camelCase, PascalCase)
      const identifiers = text.match(/\b[a-z]+[A-Z]\w+\b|\b[A-Z][a-z]+[A-Z]\w+\b/g);
      if (identifiers) identifiers.forEach(i => entities.add(i.toLowerCase()));

      // File paths
      const files = text.match(/[\w./\\-]+\.\w{1,5}/g);
      if (files) files.forEach(f => entities.add(f.toLowerCase()));

      // URLs
      const urls = text.match(/https?:\/\/\S+/g);
      if (urls) urls.forEach(u => entities.add(u.toLowerCase()));

      return entities;
    };

    const originalEntities = extractEntities(original);
    const compressedEntities = extractEntities(compressed);

    if (originalEntities.size === 0) return 1;

    let preserved = 0;
    for (const entity of originalEntities) {
      if (compressedEntities.has(entity) || compressed.toLowerCase().includes(entity)) {
        preserved++;
      }
    }

    return preserved / originalEntities.size;
  }

  private structuralPreservation(original: string, compressed: string): number {
    const originalSentences = original.split(/[.!?\n]+/).filter(s => s.trim().length > 10).length;
    const compressedSentences = compressed.split(/[.!?\n]+/).filter(s => s.trim().length > 10).length;

    if (originalSentences === 0) return 1;

    // We expect sentences to decrease, but not to near-zero
    const ratio = compressedSentences / originalSentences;
    return Math.min(ratio * 1.5, 1); // Allow some reduction while still scoring well
  }

  private semanticDensity(original: string, compressed: string): number {
    // Ratio of "information" to total length
    const getInformationDensity = (text: string): number => {
      const words = text.split(/\s+/);
      const contentWords = words.filter(w => w.length > 3 && !/^(the|and|for|that|this|with|from|have|been)$/i.test(w));
      return words.length > 0 ? contentWords.length / words.length : 0;
    };

    const originalDensity = getInformationDensity(original);
    const compressedDensity = getInformationDensity(compressed);

    // Compressed text should have higher density (less filler)
    if (compressedDensity >= originalDensity) return 1;
    return compressedDensity / Math.max(originalDensity, 0.01);
  }

  private assessReasoningRetention(original: string, compressed: string): number {
    // Check if logical connectors and reasoning patterns are preserved
    const reasoningPatterns = [
      /\b(because|therefore|thus|hence|consequently|as a result)\b/gi,
      /\b(if|then|when|unless|although|however|but)\b/gi,
      /\b(first|second|third|finally|next|then|after)\b/gi,
      /\b(must|should|need|require|important|critical)\b/gi,
    ];

    let originalReasoningCount = 0;
    let compressedReasoningCount = 0;

    for (const pattern of reasoningPatterns) {
      const origMatches = original.match(pattern);
      const compMatches = compressed.match(pattern);
      originalReasoningCount += origMatches ? origMatches.length : 0;
      compressedReasoningCount += compMatches ? compMatches.length : 0;
    }

    if (originalReasoningCount === 0) return 1;
    return Math.min(compressedReasoningCount / originalReasoningCount, 1);
  }
}
