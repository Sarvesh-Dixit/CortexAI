/**
 * Evaluation Service
 * 
 * Provides batch evaluation capabilities for the compression engine.
 * Measures quality across multiple samples and generates reports.
 */

import { SupervisorAgent } from '../agents';
import { CompressionLevel, WorkflowState } from '../agents/types';
import { logger } from '../utils/logger';

export interface EvaluationSample {
  id: string;
  text: string;
  expectedType?: string;
  expectedLanguage?: string;
}

export interface EvaluationReport {
  totalSamples: number;
  successCount: number;
  failCount: number;
  averageCompressionRatio: number;
  averageSemanticScore: number;
  averageProcessingTime: number;
  compressionLevels: Record<CompressionLevel, {
    avgRatio: number;
    avgAccuracy: number;
    avgTime: number;
    samples: number;
  }>;
  documentTypes: Record<string, number>;
  results: Array<{
    id: string;
    status: string;
    compressionRatio: number;
    semanticScore: number;
    processingTime: number;
    documentType: string;
  }>;
}

export class EvaluationService {
  private supervisor: SupervisorAgent;

  constructor() {
    this.supervisor = new SupervisorAgent();
  }

  async evaluate(
    samples: EvaluationSample[],
    level: CompressionLevel = 'medium',
    provider: string = 'openai'
  ): Promise<EvaluationReport> {
    logger.info(`[Evaluation] Starting evaluation of ${samples.length} samples`);

    const results: WorkflowState[] = [];

    for (const sample of samples) {
      try {
        const result = await this.supervisor.orchestrate({
          text: sample.text,
          userId: 'evaluation',
          compressionLevel: level,
          llmProvider: provider,
        });
        results.push(result);
      } catch (error) {
        logger.error(`[Evaluation] Sample ${sample.id} failed: ${(error as Error).message}`);
      }
    }

    return this.generateReport(results, samples);
  }

  private generateReport(results: WorkflowState[], samples: EvaluationSample[]): EvaluationReport {
    const successful = results.filter(r => r.status === 'completed' && r.analytics);
    const failed = results.filter(r => r.status === 'failed');

    const avgCompressionRatio = successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.analytics?.compressionRatio || 0), 0) / successful.length
      : 0;

    const avgSemanticScore = successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.analytics?.semanticScore || 0), 0) / successful.length
      : 0;

    const avgProcessingTime = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.totalExecutionTimeMs, 0) / successful.length
      : 0;

    // Group by document type
    const documentTypes: Record<string, number> = {};
    for (const r of successful) {
      documentTypes[r.documentType] = (documentTypes[r.documentType] || 0) + 1;
    }

    // Compression level stats (all at same level for now)
    const compressionLevels: EvaluationReport['compressionLevels'] = {
      low: { avgRatio: 0, avgAccuracy: 0, avgTime: 0, samples: 0 },
      medium: { avgRatio: avgCompressionRatio, avgAccuracy: avgSemanticScore, avgTime: avgProcessingTime, samples: successful.length },
      high: { avgRatio: 0, avgAccuracy: 0, avgTime: 0, samples: 0 },
      extreme: { avgRatio: 0, avgAccuracy: 0, avgTime: 0, samples: 0 },
    };

    return {
      totalSamples: samples.length,
      successCount: successful.length,
      failCount: failed.length,
      averageCompressionRatio: avgCompressionRatio,
      averageSemanticScore: avgSemanticScore,
      averageProcessingTime: avgProcessingTime,
      compressionLevels,
      documentTypes,
      results: results.map((r, i) => ({
        id: samples[i]?.id || r.id,
        status: r.status,
        compressionRatio: r.analytics?.compressionRatio || 0,
        semanticScore: r.analytics?.semanticScore || 0,
        processingTime: r.totalExecutionTimeMs,
        documentType: r.documentType,
      })),
    };
  }
}
