/**
 * Input Processing Agent
 * 
 * Responsibilities:
 * - Read uploaded files
 * - Convert everything into normalized text
 * - Maintain original formatting where needed
 * - Handle: PDF, DOCX, TXT, CSV, Markdown, Logs, Source Code, JSON
 */

import { AgentNode, WorkflowState } from '../types';

export class InputProcessingNode implements AgentNode {
  name = 'input_processing';

  shouldExecute(_state: WorkflowState): boolean {
    return true; // Always executes as the entry point
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const text = state.originalText;

    if (!text || text.trim().length === 0) {
      throw new Error('No input text provided for processing');
    }

    // Normalize line endings
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove BOM if present
    if (processed.charCodeAt(0) === 0xFEFF) {
      processed = processed.slice(1);
    }

    // Trim leading/trailing whitespace while preserving internal structure
    processed = processed.trim();

    // Normalize Unicode characters
    processed = processed.normalize('NFC');

    // Remove null bytes and other control characters (except newlines and tabs)
    processed = processed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return {
      ...state,
      processedText: processed,
    };
  }
}
