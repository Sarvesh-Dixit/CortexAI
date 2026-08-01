/**
 * Core type definitions for the Multi-Agent Pipeline.
 * Every agent operates on a shared WorkflowState object.
 * The Supervisor orchestrates execution order and manages state merging.
 */

export type DocumentType =
  | 'code'
  | 'logs'
  | 'research_paper'
  | 'email'
  | 'technical_documentation'
  | 'chat_history'
  | 'legal_document'
  | 'json'
  | 'markdown'
  | 'csv'
  | 'text';

export type CompressionLevel = 'low' | 'medium' | 'high' | 'extreme';

export type AgentStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface AgentResult {
  agentName: string;
  status: AgentStatus;
  executionTimeMs: number;
  warnings: string[];
  errors: string[];
  metadata: Record<string, unknown>;
}

export interface TokenAnalysis {
  characters: number;
  words: number;
  tokens: number;
  sentences: number;
  paragraphs: number;
  estimatedCost: Record<string, number>;
  estimatedLatencyMs: number;
  contextWindowUsage: Record<string, number>;
}

export interface SimilarityResult {
  sentencePairs: Array<{
    indexA: number;
    indexB: number;
    similarity: number;
  }>;
  redundantSentenceIndices: number[];
  overallRedundancy: number;
}

export interface DuplicateResult {
  duplicateSentences: Array<{ original: number; duplicate: number; text: string }>;
  duplicateParagraphs: Array<{ original: number; duplicate: number }>;
  duplicateImports: string[];
  repeatedFunctions: string[];
  totalDuplicates: number;
}

export interface BoilerplateResult {
  greetings: string[];
  closings: string[];
  repeatedHeaders: string[];
  repeatedFooters: string[];
  templates: string[];
  removalCandidates: Array<{ start: number; end: number; reason: string }>;
}

export interface CodeAnalysisResult {
  functions: string[];
  classes: string[];
  imports: string[];
  comments: Array<{ line: number; text: string; removable: boolean }>;
  unusedBlankLines: number[];
  duplicateImports: string[];
  language: string;
}

export interface LogAnalysisResult {
  levels: Record<string, number>;
  repeatedMessages: Array<{ message: string; count: number; firstLine: number }>;
  uniqueErrors: string[];
  summary: string;
}

export interface ImportanceScore {
  sentenceIndex: number;
  score: number;
  reasons: string[];
}

export interface ValidationResult {
  semanticSimilarity: number;
  compressionRatio: number;
  estimatedAccuracy: number;
  reasoningRetention: number;
  approved: boolean;
  issues: string[];
}

export interface WorkflowState {
  // Input
  id: string;
  userId: string;
  originalText: string;
  filename?: string;
  compressionLevel: CompressionLevel;
  llmProvider: string;

  // Processing stages
  processedText: string;
  documentType: DocumentType;
  detectedLanguage: string;
  tokenAnalysis: TokenAnalysis | null;
  similarityResult: SimilarityResult | null;
  duplicateResult: DuplicateResult | null;
  boilerplateResult: BoilerplateResult | null;
  codeAnalysisResult: CodeAnalysisResult | null;
  logAnalysisResult: LogAnalysisResult | null;
  importanceScores: ImportanceScore[];

  // Output
  compressedText: string;
  validation: ValidationResult | null;

  // Analytics
  analytics: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    semanticScore: number;
    costSavings: number;
    latencyImprovement: number;
    originalCost: number;
    compressedCost: number;
  } | null;

  // Execution tracking
  agentResults: AgentResult[];
  currentAgent: string;
  startTime: number;
  endTime: number | null;
  totalExecutionTimeMs: number;
  status: 'running' | 'completed' | 'failed';
  error: string | null;
}

export interface AgentNode {
  name: string;
  execute(state: WorkflowState): Promise<WorkflowState>;
  shouldExecute(state: WorkflowState): boolean;
}
