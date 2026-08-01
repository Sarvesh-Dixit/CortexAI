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
  }): Promise<WorkflowState> {
    logger.info(`[Supervisor] Starting orchestration for user: ${input.userId}`);

    const initialState: WorkflowState = {
      id: uuid(),
      userId: input.userId,
      originalText: input.text,
      filename: input.filename,
      compressionLevel: input.compressionLevel,
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

    const finalState = await this.graph.execute(initialState);

    logger.info(`[Supervisor] Orchestration complete. Status: ${finalState.status}, ` +
      `Agents executed: ${finalState.agentResults.length}, ` +
      `Total time: ${finalState.totalExecutionTimeMs}ms`);

    return finalState;
  }
}
