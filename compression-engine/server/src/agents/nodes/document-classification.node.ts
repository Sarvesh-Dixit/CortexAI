/**
 * Document Classification Agent
 * 
 * Purpose: Determine document type.
 * The next workflow depends on this result.
 * 
 * Possible outputs:
 * - code, logs, research_paper, email, technical_documentation
 * - chat_history, legal_document, json, markdown, csv, text
 */

import { AgentNode, WorkflowState, DocumentType } from '../types';

interface ClassificationSignal {
  type: DocumentType;
  confidence: number;
}

export class DocumentClassificationNode implements AgentNode {
  name = 'document_classification';

  shouldExecute(_state: WorkflowState): boolean {
    return true;
  }

  async execute(state: WorkflowState): Promise<WorkflowState> {
    const text = state.processedText;
    const filename = state.filename;

    const classification = this.classify(text, filename);

    return {
      ...state,
      documentType: classification.type,
    };
  }

  private classify(text: string, filename?: string): ClassificationSignal {
    // File extension based classification (highest confidence)
    if (filename) {
      const extResult = this.classifyByExtension(filename);
      if (extResult) return extResult;
    }

    // Content-based classification
    const signals: ClassificationSignal[] = [];

    signals.push(this.checkCode(text));
    signals.push(this.checkLogs(text));
    signals.push(this.checkJson(text));
    signals.push(this.checkMarkdown(text));
    signals.push(this.checkCsv(text));
    signals.push(this.checkEmail(text));
    signals.push(this.checkLegal(text));
    signals.push(this.checkResearchPaper(text));
    signals.push(this.checkTechnicalDocs(text));
    signals.push(this.checkChatHistory(text));

    // Return highest confidence classification
    signals.sort((a, b) => b.confidence - a.confidence);

    if (signals[0].confidence > 0.3) {
      return signals[0];
    }

    return { type: 'text', confidence: 0.5 };
  }

  private classifyByExtension(filename: string): ClassificationSignal | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, DocumentType> = {
      py: 'code', js: 'code', ts: 'code', java: 'code', cpp: 'code', c: 'code',
      rb: 'code', go: 'code', rs: 'code', swift: 'code', kt: 'code',
      log: 'logs',
      json: 'json',
      md: 'markdown',
      csv: 'csv',
      txt: 'text',
      pdf: 'text',
      docx: 'text',
    };

    if (ext && map[ext]) {
      return { type: map[ext], confidence: 0.95 };
    }
    return null;
  }

  private checkCode(text: string): ClassificationSignal {
    const indicators = [
      /^(import|from|require|using|package)\s/m,
      /^(def|function|class|interface|struct|enum)\s/m,
      /^(public|private|protected|static)\s/m,
      /[{}\[\]();]\s*$/m,
      /^\s*(if|else|for|while|switch|try|catch)\s*[\({]/m,
      /=>/,
      /\b(const|let|var|int|string|bool|float)\b/,
      /#include\s*[<"]/,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'code', confidence: Math.min(matches / 4, 1) };
  }

  private checkLogs(text: string): ClassificationSignal {
    const indicators = [
      /\[(INFO|WARN|ERROR|DEBUG|TRACE|FATAL)\]/i,
      /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/,
      /^(INFO|WARN|ERROR|DEBUG)\s/m,
      /at\s+[\w.]+\([\w.:]+\)/,
      /^\d{2}:\d{2}:\d{2}\.\d+/m,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'logs', confidence: Math.min(matches / 3, 1) };
  }

  private checkJson(text: string): ClassificationSignal {
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return { type: 'json', confidence: 0.95 };
      } catch {
        return { type: 'json', confidence: 0.3 };
      }
    }
    return { type: 'json', confidence: 0 };
  }

  private checkMarkdown(text: string): ClassificationSignal {
    const indicators = [
      /^#{1,6}\s+\S/m,
      /^\s*[-*+]\s/m,
      /\[.+\]\(.+\)/,
      /^```/m,
      /^\|.+\|$/m,
      /\*\*.+\*\*/,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'markdown', confidence: Math.min(matches / 3, 1) };
  }

  private checkCsv(text: string): ClassificationSignal {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { type: 'csv', confidence: 0 };

    const firstLineCommas = (lines[0].match(/,/g) || []).length;
    if (firstLineCommas < 1) return { type: 'csv', confidence: 0 };

    // Check if most lines have similar comma count
    const consistentLines = lines.slice(0, 10).filter(l => {
      const commas = (l.match(/,/g) || []).length;
      return Math.abs(commas - firstLineCommas) <= 1;
    });

    const confidence = consistentLines.length / Math.min(lines.length, 10);
    return { type: 'csv', confidence: confidence > 0.7 ? 0.85 : confidence * 0.5 };
  }

  private checkEmail(text: string): ClassificationSignal {
    const indicators = [
      /^(From|To|Subject|Date|CC|BCC):\s/m,
      /^Sent:\s/m,
      /^Dear\s/m,
      /^(Best regards|Sincerely|Thanks|Cheers),?\s*$/m,
      /--\s*\n.*(?:@|tel|phone)/s,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'email', confidence: Math.min(matches / 3, 1) };
  }

  private checkLegal(text: string): ClassificationSignal {
    const indicators = [
      /\b(WHEREAS|HEREBY|PURSUANT|NOTWITHSTANDING)\b/,
      /\b(herein|thereof|therein|thereto|heretofore)\b/i,
      /\b(party|parties|agreement|contract|terms|conditions)\b/i,
      /\b(section|article|clause|paragraph)\s+\d/i,
      /\b(shall|obligat|indemnif|warrant|disclaim)\b/i,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'legal_document', confidence: Math.min(matches / 3, 1) };
  }

  private checkResearchPaper(text: string): ClassificationSignal {
    const indicators = [
      /\b(abstract|introduction|methodology|conclusion|references)\b/i,
      /\b(et al\.|Fig\.\s*\d|Table\s*\d)\b/,
      /\[\d+\]/,
      /\b(hypothesis|experiment|results|discussion|findings)\b/i,
      /\b(doi|isbn|issn|arxiv)\b/i,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'research_paper', confidence: Math.min(matches / 3, 1) };
  }

  private checkTechnicalDocs(text: string): ClassificationSignal {
    const indicators = [
      /\b(API|endpoint|parameter|request|response|payload)\b/i,
      /\b(install|configure|setup|deploy|build)\b/i,
      /```[\w]*\n/,
      /\b(usage|example|documentation|guide|tutorial)\b/i,
      /\b(GET|POST|PUT|DELETE|PATCH)\s+\//,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'technical_documentation', confidence: Math.min(matches / 3, 1) };
  }

  private checkChatHistory(text: string): ClassificationSignal {
    const indicators = [
      /^(User|Assistant|Human|AI|Bot|System):/m,
      /^\[?\d{1,2}:\d{2}\]?\s/m,
      /^>\s.+/m,
    ];

    const matches = indicators.filter(p => p.test(text)).length;
    return { type: 'chat_history', confidence: Math.min(matches / 2, 1) };
  }
}
