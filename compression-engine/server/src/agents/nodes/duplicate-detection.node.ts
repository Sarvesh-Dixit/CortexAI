/**
 * Duplicate Detection Agent
 * 
 * Responsibilities:
 * - Detect: Duplicate Sentences, Duplicate Paragraphs,
 *   Duplicate Imports, Repeated Documentation, Repeated Functions
 * - Generate removal candidates
 */

import { AgentNode, WorkflowState, DuplicateResult } from '../types';

export class DuplicateDetectionNode implements AgentNode {
  name = 'duplicate_detection';

  shouldExecute(_state: WorkflowState): boolean {
    return true;
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const text = state.processedText;
    const result = this.detectDuplicates(text, state.documentType);

    return {
      ...state,
      duplicateResult: result,
    };
  }

  private detectDuplicates(text: string, docType: string): DuplicateResult {
    const duplicateSentences = this.findDuplicateSentences(text);
    const duplicateParagraphs = this.findDuplicateParagraphs(text);
    const duplicateImports = docType === 'code' ? this.findDuplicateImports(text) : [];
    const repeatedFunctions = docType === 'code' ? this.findRepeatedFunctions(text) : [];

    return {
      duplicateSentences,
      duplicateParagraphs,
      duplicateImports,
      repeatedFunctions,
      totalDuplicates: duplicateSentences.length + duplicateParagraphs.length +
        duplicateImports.length + repeatedFunctions.length,
    };
  }

  private findDuplicateSentences(text: string): Array<{ original: number; duplicate: number; text: string }> {
    const sentences = text.split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    const results: Array<{ original: number; duplicate: number; text: string }> = [];
    const seen = new Map<string, number>();

    for (let i = 0; i < sentences.length; i++) {
      const normalized = sentences[i].toLowerCase().replace(/\s+/g, ' ');

      if (seen.has(normalized)) {
        results.push({
          original: seen.get(normalized)!,
          duplicate: i,
          text: sentences[i],
        });
      } else {
        seen.set(normalized, i);
      }
    }

    return results;
  }

  private findDuplicateParagraphs(text: string): Array<{ original: number; duplicate: number }> {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    const results: Array<{ original: number; duplicate: number }> = [];
    const seen = new Map<string, number>();

    for (let i = 0; i < paragraphs.length; i++) {
      const normalized = paragraphs[i].trim().toLowerCase().replace(/\s+/g, ' ');
      const key = normalized.slice(0, 100); // Use first 100 chars as fingerprint

      if (seen.has(key)) {
        // Verify full similarity
        const originalIdx = seen.get(key)!;
        const originalNorm = paragraphs[originalIdx].trim().toLowerCase().replace(/\s+/g, ' ');
        if (this.jaccardSimilarity(normalizedWords(originalNorm), normalizedWords(normalized)) > 0.8) {
          results.push({ original: originalIdx, duplicate: i });
        }
      } else {
        seen.set(key, i);
      }
    }

    return results;
  }

  private findDuplicateImports(text: string): string[] {
    const importPatterns = [
      /^import\s+.+$/gm,
      /^from\s+.+\s+import\s+.+$/gm,
      /^const\s+.+\s*=\s*require\(.+\)/gm,
      /^using\s+.+;$/gm,
      /^#include\s+.+$/gm,
    ];

    const allImports: string[] = [];
    for (const pattern of importPatterns) {
      const matches = text.match(pattern);
      if (matches) allImports.push(...matches);
    }

    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const imp of allImports) {
      const normalized = imp.trim().replace(/\s+/g, ' ');
      if (seen.has(normalized)) {
        duplicates.push(imp);
      } else {
        seen.add(normalized);
      }
    }

    return duplicates;
  }

  private findRepeatedFunctions(text: string): string[] {
    // Detect function signatures that appear more than once
    const functionPatterns = [
      /(?:function|def|fn)\s+(\w+)\s*\(/g,
      /(\w+)\s*=\s*(?:function|\(.*?\)\s*=>)/g,
    ];

    const functionNames: string[] = [];
    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        functionNames.push(match[1]);
      }
    }

    const counts = new Map<string, number>();
    for (const name of functionNames) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([name]) => name);
  }

  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
}

function normalizedWords(text: string): Set<string> {
  return new Set(text.split(/\s+/).filter(w => w.length > 2));
}
