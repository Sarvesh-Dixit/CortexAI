/**
 * Log Analysis Agent
 * 
 * Responsibilities:
 * - Identify log levels: INFO, WARNING, ERROR, TRACE
 * - Detect repeated messages
 * - Summarize repetitive logs
 * - NEVER remove unique errors
 */

import { AgentNode, WorkflowState, LogAnalysisResult } from '../types';

export class LogAnalysisNode implements AgentNode {
  name = 'log_analysis';

  shouldExecute(state: WorkflowState): boolean {
    return state.documentType === 'logs';
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const text = state.processedText;
    const result = this.analyzeLogs(text);

    return {
      ...state,
      logAnalysisResult: result,
    };
  }

  private analyzeLogs(text: string): LogAnalysisResult {
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    const levels = this.countLogLevels(lines);
    const repeatedMessages = this.findRepeatedMessages(lines);
    const uniqueErrors = this.extractUniqueErrors(lines);
    const summary = this.generateSummary(levels, repeatedMessages, uniqueErrors);

    return { levels, repeatedMessages, uniqueErrors, summary };
  }

  private countLogLevels(lines: string[]): Record<string, number> {
    const levels: Record<string, number> = {
      info: 0, warn: 0, error: 0, debug: 0, trace: 0, fatal: 0, unknown: 0,
    };

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/\b(INFO)\b/.test(upper)) levels.info++;
      else if (/\b(WARN|WARNING)\b/.test(upper)) levels.warn++;
      else if (/\b(ERROR|ERR)\b/.test(upper)) levels.error++;
      else if (/\b(DEBUG|DBG)\b/.test(upper)) levels.debug++;
      else if (/\b(TRACE|TRC)\b/.test(upper)) levels.trace++;
      else if (/\b(FATAL|CRITICAL)\b/.test(upper)) levels.fatal++;
      else levels.unknown++;
    }

    return levels;
  }

  private findRepeatedMessages(lines: string[]): Array<{ message: string; count: number; firstLine: number }> {
    // Normalize log lines by removing timestamps, IDs, and specific values
    const normalized = lines.map(line => {
      return line
        .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '[TS]')
        .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, '[IP]')
        .replace(/\b[0-9a-f]{8,}\b/gi, '[ID]')
        .replace(/\b\d{4,}\b/g, '[NUM]')
        .replace(/\s+/g, ' ')
        .trim();
    });

    const counts = new Map<string, { count: number; firstLine: number; original: string }>();

    for (let i = 0; i < normalized.length; i++) {
      const key = normalized[i];
      if (!counts.has(key)) {
        counts.set(key, { count: 0, firstLine: i, original: lines[i] });
      }
      counts.get(key)!.count++;
    }

    return Array.from(counts.values())
      .filter(v => v.count > 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(v => ({
        message: v.original.slice(0, 200),
        count: v.count,
        firstLine: v.firstLine,
      }));
  }

  private extractUniqueErrors(lines: string[]): string[] {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/\b(ERROR|FATAL|CRITICAL|EXCEPTION)\b/.test(upper)) {
        const normalized = line
          .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!seen.has(normalized)) {
          seen.add(normalized);
          errors.push(line.trim());
        }
      }
    }

    return errors;
  }

  private generateSummary(
    levels: Record<string, number>,
    repeated: Array<{ message: string; count: number }>,
    uniqueErrors: string[]
  ): string {
    const total = Object.values(levels).reduce((sum, v) => sum + v, 0);
    const totalRepeated = repeated.reduce((sum, r) => sum + r.count, 0);

    return `Log Summary: ${total} total lines. ` +
      `Levels: INFO=${levels.info}, WARN=${levels.warn}, ERROR=${levels.error}, DEBUG=${levels.debug}. ` +
      `Repeated patterns: ${repeated.length} (${totalRepeated} lines). ` +
      `Unique errors: ${uniqueErrors.length}.`;
  }
}
