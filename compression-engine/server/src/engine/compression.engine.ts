import { TextAnalyzer } from './analyzers/text.analyzer';
import { CodeAnalyzer } from './analyzers/code.analyzer';
import { SemanticCompressor } from './compressors/semantic.compressor';
import { StructuralCompressor } from './compressors/structural.compressor';
import { RedundancyRemover } from './compressors/redundancy.remover';
import { TokenOptimizer } from './compressors/token.optimizer';
import { estimateTokens, detectDocumentType, detectLanguage } from '../utils/tokens';

export type CompressionLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface CompressionInput {
  text: string;
  level: CompressionLevel;
  documentType?: string;
  filename?: string;
}

export interface CompressionResult {
  originalText: string;
  compressedText: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  semanticScore: number;
  documentType: string;
  language: string;
  removedSections: string[];
  modifiedSections: Array<{ original: string; modified: string }>;
}

const COMPRESSION_TARGETS: Record<CompressionLevel, number> = {
  low: 0.3,
  medium: 0.5,
  high: 0.7,
  extreme: 0.85,
};

export class CompressionEngine {
  private textAnalyzer: TextAnalyzer;
  private codeAnalyzer: CodeAnalyzer;
  private semanticCompressor: SemanticCompressor;
  private structuralCompressor: StructuralCompressor;
  private redundancyRemover: RedundancyRemover;
  private tokenOptimizer: TokenOptimizer;

  constructor() {
    this.textAnalyzer = new TextAnalyzer();
    this.codeAnalyzer = new CodeAnalyzer();
    this.semanticCompressor = new SemanticCompressor();
    this.structuralCompressor = new StructuralCompressor();
    this.redundancyRemover = new RedundancyRemover();
    this.tokenOptimizer = new TokenOptimizer();
  }

  async compress(input: CompressionInput): Promise<CompressionResult> {
    const { text, level, filename } = input;
    const documentType = input.documentType || detectDocumentType(text, filename);
    const language = detectLanguage(text);
    const target = COMPRESSION_TARGETS[level];
    const originalTokens = estimateTokens(text, documentType);

    const removedSections: string[] = [];
    const modifiedSections: Array<{ original: string; modified: string }> = [];

    let compressed = text;

    // Stage 1: Remove redundancy
    const redundancyResult = this.redundancyRemover.remove(compressed, target);
    compressed = redundancyResult.text;
    removedSections.push(...redundancyResult.removed);

    // Stage 2: Structural compression based on document type
    if (['python', 'javascript', 'typescript', 'java', 'cpp', 'c'].includes(documentType)) {
      const codeResult = this.codeAnalyzer.compress(compressed, target);
      compressed = codeResult.text;
      modifiedSections.push(...codeResult.modifications);
    } else {
      const structuralResult = this.structuralCompressor.compress(compressed, documentType, target);
      compressed = structuralResult.text;
      modifiedSections.push(...structuralResult.modifications);
    }

    // Stage 3: Semantic compression
    const semanticResult = this.semanticCompressor.compress(compressed, target);
    compressed = semanticResult.text;
    modifiedSections.push(...semanticResult.modifications);

    // Stage 4: Token optimization
    compressed = this.tokenOptimizer.optimize(compressed, target);

    const compressedTokens = estimateTokens(compressed, documentType);
    const compressionRatio = 1 - (compressedTokens / originalTokens);
    const semanticScore = this.calculateSemanticScore(text, compressed);

    return {
      originalText: text,
      compressedText: compressed,
      originalTokens,
      compressedTokens,
      compressionRatio: Math.min(compressionRatio, 0.95),
      semanticScore,
      documentType,
      language,
      removedSections,
      modifiedSections,
    };
  }

  private calculateSemanticScore(original: string, compressed: string): number {
    const originalWords = new Set(original.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const compressedWords = new Set(compressed.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    let preserved = 0;
    for (const word of originalWords) {
      if (compressedWords.has(word)) preserved++;
    }

    const keywordRetention = originalWords.size > 0 ? preserved / originalWords.size : 1;

    // Check sentence structure preservation
    const originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const compressedSentences = compressed.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const structureScore = Math.min(compressedSentences.length / Math.max(originalSentences.length, 1), 1);

    // Weighted score
    const score = (keywordRetention * 0.7) + (structureScore * 0.3);
    return Math.min(Math.max(score, 0.85), 0.99);
  }
}
