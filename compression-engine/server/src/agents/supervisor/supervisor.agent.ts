/**
 * Supervisor Agent - The Brain of the System.
 * 
 * Responsibilities:
 * - Receive request
 * - Determine file type
 * - Determine workflow
 * - Choose compression strategy
 * - Invoke required agents
 * - Collect outputs
 * - Generate final workflow state
 * 
 * The Supervisor NEVER performs compression directly.
 * It only orchestrates the multi-agent pipeline.
 */

import { v4 as uuid } from 'uuid';
import { WorkflowState, CompressionLevel } from '../types';
import { WorkflowGraph as Graph } from './graph';

/** Ordered from most to least aggressive — used for adaptive fallback */
const LEVEL_LADDER: CompressionLevel[] = ['extreme', 'high', 'medium', 'low'];
import { InputProcessingNode } from '../nodes/input-processing.node';
import { DocumentClassificationNode } from '../nodes/document-classification.node';
import { LanguageDetectionNode } from '../nodes/language-detection.node';
import { TokenAnalysisNode } from '../nodes/token-analysis.node';
import { SemanticSimilarityNode } from '../nodes/semantic-similarity.node';
import { DuplicateDetectionNode } from '../nodes/duplicate-detection.node';
import { BoilerplateRemovalNode } from '../nodes/boilerplate-removal.node';
import { CodeAnalysisNode } from '../nodes/code-analysis.node';
import { LogAnalysisNode } from '../nodes/log-analysis.node';
import { ImportanceScoringNode } from '../nodes/importance-scoring.node';
import { CompressionNode } from '../nodes/compression.node';
import { ValidationNode } from '../nodes/validation.node';
import { DashboardNode } from '../nodes/dashboard.node';
import { logger } from '../../utils/logger';

export class SupervisorAgent {
  private graph: Graph;

  constructor() {
    this.graph = this.buildGraph();
  }

  private buildGraph(): Graph {
    const graph = new Graph();

    // Register all agent nodes
    graph
      .addNode(new InputProcessingNode(), { retries: 2 })
      .addNode(new DocumentClassificationNode())
      .addNode(new LanguageDetectionNode())
      .addNode(new TokenAnalysisNode())
      .addNode(new SemanticSimilarityNode(), { retries: 1 })
      .addNode(new DuplicateDetectionNode())
      .addNode(new BoilerplateRemovalNode())
      .addNode(new CodeAnalysisNode())
      .addNode(new LogAnalysisNode())
      .addNode(new ImportanceScoringNode())
      .addNode(new CompressionNode(), { retries: 2 })
      .addNode(new ValidationNode(), { retries: 2 })
      .addNode(new DashboardNode());

    // Define execution flow
    graph.setEntry('input_processing');

    // Sequential core pipeline
    graph.addEdge('input_processing', 'document_classification');
    graph.addEdge('document_classification', 'language_detection');
    graph.addEdge('language_detection', 'token_analysis');
    graph.addEdge('token_analysis', 'semantic_similarity');
    graph.addEdge('semantic_similarity', 'duplicate_detection');
    graph.addEdge('duplicate_detection', 'boilerplate_removal');

    // Conditional routing based on document type
    graph.addEdge('boilerplate_removal', 'code_analysis',
      (state) => ['code'].includes(state.documentType)
    );
    graph.addEdge('boilerplate_removal', 'log_analysis',
      (state) => state.documentType === 'logs'
    );
    graph.addEdge('boilerplate_removal', 'importance_scoring',
      (state) => !['code', 'logs'].includes(state.documentType)
    );

    // Converge back to importance scoring
    graph.addEdge('code_analysis', 'importance_scoring');
    graph.addEdge('log_analysis', 'importance_scoring');

    // Final compression and validation
    graph.addEdge('importance_scoring', 'compression');
    graph.addEdge('compression', 'validation');
    graph.addEdge('validation', 'dashboard');

    return graph;
  }

  async orchestrate(input: {
    text: string;
    userId: string;
    compressionLevel: CompressionLevel;
    llmProvider: string;
    filename?: string;
    /** Minimum estimated accuracy required (0-1). If a run falls below this,
     *  the supervisor automatically retries with a lighter compression level.
     *  Default 0.95 to satisfy the >95% accuracy requirement. */
    accuracyTarget?: number;
  }): Promise<WorkflowState> {
    const target = input.accuracyTarget ?? 0.95;
    logger.info(`[Supervisor] Starting orchestration user=${input.userId} target=${target}`);

    // Build the fallback ladder starting from the requested level, then
    // progressively lighter levels. This guarantees the highest-compression
    // result that still meets the accuracy target.
    const requestedIdx = LEVEL_LADDER.indexOf(input.compressionLevel);
    const startIdx = requestedIdx >= 0 ? requestedIdx : 1; // default to 'high'
    const attempts: CompressionLevel[] = LEVEL_LADDER.slice(startIdx);

    let lastState: WorkflowState | null = null;
    let bestState: WorkflowState | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const level = attempts[i];
      const state = this.buildInitialState(input, level);
      const result = await this.graph.execute(state);
      lastState = result;

      const accuracy = result.analytics?.semanticScore ?? 0;
      logger.info(
        `[Supervisor] Attempt ${i + 1}/${attempts.length} @ ${level}: accuracy=${(accuracy * 100).toFixed(1)}%, ` +
        `ratio=${((result.analytics?.compressionRatio ?? 0) * 100).toFixed(1)}%`
      );

      // Track the highest-compression result that meets the target
      if (accuracy >= target && !bestState) {
        bestState = result;
        break; // early exit: found a result that satisfies the requirement
      }

      // Track the best available even if none meets target
      if (!bestState || accuracy > (bestState.analytics?.semanticScore ?? 0)) {
        bestState = result;
      }
    }

    const finalState = bestState || lastState!;
    const finalAccuracy = finalState.analytics?.semanticScore ?? 0;
    const finalLevel = finalState.compressionLevel;

    if (finalLevel !== input.compressionLevel) {
      logger.info(
        `[Supervisor] Adaptive fallback: requested "${input.compressionLevel}" ` +
        `→ used "${finalLevel}" to meet ${(target * 100).toFixed(0)}% accuracy target ` +
        `(final: ${(finalAccuracy * 100).toFixed(1)}%)`
      );
    }

    logger.info(`[Supervisor] Complete. Status: ${finalState.status}, ` +
      `Agents executed: ${finalState.agentResults.length}, ` +
      `Total time: ${finalState.totalExecutionTimeMs}ms`);

    return finalState;
  }

  private buildInitialState(
    input: { text: string; userId: string; llmProvider: string; filename?: string },
    level: CompressionLevel
  ): WorkflowState {
    return {
      id: uuid(),
      userId: input.userId,
      originalText: input.text,
      filename: input.filename,
      compressionLevel: level,
      llmProvider: input.llmProvider,
      processedText: '',
      documentType: 'text',
      detectedLanguage: 'english',
      tokenAnalysis: null,
      similarityResult: null,
      duplicateResult: null,
      boilerplateResult: null,
      codeAnalysisResult: null,
      logAnalysisResult: null,
      importanceScores: [],
      compressedText: '',
      validation: null,
      analytics: null,
      agentResults: [],
      currentAgent: 'supervisor',
      startTime: Date.now(),
      endTime: null,
      totalExecutionTimeMs: 0,
      status: 'running',
      error: null,
    };
  }
}
