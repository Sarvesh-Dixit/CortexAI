/**
 * Importance Scoring Agent
 * 
 * Responsibilities:
 * - Assign importance score to each sentence
 * - Score using: Semantic similarity, Named entities, Keywords,
 *   User questions, Error messages, Stack traces, Variable names,
 *   File names, API endpoints
 * - High score content → Always preserve
 */

import { AgentNode, WorkflowState, ImportanceScore } from '../types';

export class ImportanceScoringNode implements AgentNode {
  name = 'importance_scoring';

  shouldExecute(_state: WorkflowState): boolean {
    return true;
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const text = state.processedText;
    const sentences = this.splitIntoScorableUnits(text);
    const scores = this.scoreAll(sentences, state);

    return {
      ...state,
      importanceScores: scores,
    };
  }

  private splitIntoScorableUnits(text: string): string[] {
    // Split by sentences and newlines, keeping reasonable chunks
    return text
      .split(/(?<=[.!?\n])\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  private scoreAll(sentences: string[], state: WorkflowState): ImportanceScore[] {
    return sentences.map((sentence, index) => {
      const reasons: string[] = [];
      let score = 0.5; // Base score

      // Named entities (capitalized words that aren't sentence starters)
      const namedEntities = sentence.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (namedEntities && namedEntities.length > 0) {
        score += 0.05 * Math.min(namedEntities.length, 3);
        reasons.push('named_entities');
      }

      // Technical keywords
      if (this.hasTechnicalKeywords(sentence)) {
        score += 0.15;
        reasons.push('technical_keywords');
      }

      // Error messages and stack traces
      if (this.isErrorRelated(sentence)) {
        score += 0.25;
        reasons.push('error_content');
      }

      // Questions (likely user queries - always important)
      if (/\?$/.test(sentence.trim())) {
        score += 0.2;
        reasons.push('question');
      }

      // Code identifiers (variable names, function calls)
      if (this.hasCodeIdentifiers(sentence)) {
        score += 0.1;
        reasons.push('code_identifiers');
      }

      // File names and paths
      if (/[\w/\\]+\.\w{1,5}\b/.test(sentence)) {
        score += 0.1;
        reasons.push('file_references');
      }

      // API endpoints
      if (/\b(GET|POST|PUT|DELETE|PATCH)\s+\//.test(sentence) || /\/api\/\w+/.test(sentence)) {
        score += 0.15;
        reasons.push('api_endpoints');
      }

      // URLs
      if (/https?:\/\/\S+/.test(sentence)) {
        score += 0.08;
        reasons.push('urls');
      }

      // Numbers and data (specific values tend to be important)
      const numbers = sentence.match(/\b\d+[\d.,]*\b/g);
      if (numbers && numbers.length > 0) {
        score += 0.05;
        reasons.push('numeric_data');
      }

      // First and last sentences of paragraphs are often summaries
      if (index === 0 || index === sentences.length - 1) {
        score += 0.1;
        reasons.push('position_importance');
      }

      // Redundancy penalty (informed by similarity agent)
      if (state.similarityResult) {
        if (state.similarityResult.redundantSentenceIndices.includes(index)) {
          score -= 0.3;
          reasons.push('redundant');
        }
      }

      // If it was marked as boilerplate, lower score significantly
      if (state.boilerplateResult) {
        const isBoilerplate = state.boilerplateResult.removalCandidates.some(c =>
          sentence.toLowerCase().includes(
            state.processedText.slice(c.start, c.end).toLowerCase().slice(0, 30)
          )
        );
        if (isBoilerplate) {
          score -= 0.3;
          reasons.push('boilerplate');
        }
      }

      return {
        sentenceIndex: index,
        score: Math.max(0, Math.min(1, score)),
        reasons,
      };
    });
  }

  private hasTechnicalKeywords(sentence: string): boolean {
    const keywords = [
      /\b(function|method|class|interface|module|component|service|controller)\b/i,
      /\b(database|server|client|request|response|endpoint|middleware)\b/i,
      /\b(error|exception|warning|bug|issue|problem|fix|solution)\b/i,
      /\b(config|environment|variable|parameter|argument|option)\b/i,
      /\b(deploy|build|compile|install|test|run|execute)\b/i,
      /\b(algorithm|pattern|architecture|design|structure)\b/i,
    ];

    return keywords.some(p => p.test(sentence));
  }

  private isErrorRelated(sentence: string): boolean {
    return /\b(error|exception|stack\s*trace|traceback|failed|failure|crash|panic|fatal)\b/i.test(sentence) ||
      /at\s+[\w.]+\([\w.:]+\)/.test(sentence) ||
      /^\s*(File|Traceback|raise|throw)\b/.test(sentence);
  }

  private hasCodeIdentifiers(sentence: string): boolean {
    // camelCase, snake_case, or dot.notation identifiers
    return /\b[a-z][a-zA-Z0-9]*[A-Z]\w*\b/.test(sentence) ||
      /\b\w+_\w+\b/.test(sentence) ||
      /\b\w+\.\w+\(/.test(sentence);
  }
}
