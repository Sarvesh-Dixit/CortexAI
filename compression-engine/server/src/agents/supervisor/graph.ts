/**
 * LangGraph-style Workflow Graph.
 * Manages agent execution order, conditional routing, parallel execution,
 * retry logic, failure recovery, and state management.
 */

import { WorkflowState, AgentNode, AgentResult } from '../types';
import { logger } from '../../utils/logger';

export type RouteCondition = (state: WorkflowState) => boolean;

interface GraphEdge {
  from: string;
  to: string;
  condition?: RouteCondition;
}

interface GraphNodeEntry {
  node: AgentNode;
  parallel?: string[];
  retries: number;
}

export class WorkflowGraph {
  private nodes: Map<string, GraphNodeEntry> = new Map();
  private edges: GraphEdge[] = [];
  private entryNode: string | null = null;

  addNode(node: AgentNode, options?: { retries?: number; parallel?: string[] }): this {
    this.nodes.set(node.name, {
      node,
      retries: options?.retries ?? 1,
      parallel: options?.parallel,
    });
    return this;
  }

  addEdge(from: string, to: string, condition?: RouteCondition): this {
    this.edges.push({ from, to, condition });
    return this;
  }

  setEntry(nodeName: string): this {
    this.entryNode = nodeName;
    return this;
  }

  private getNextNodes(currentNode: string, state: WorkflowState): string[] {
    const outEdges = this.edges.filter(e => e.from === currentNode);
    const next: string[] = [];

    for (const edge of outEdges) {
      if (!edge.condition || edge.condition(state)) {
        next.push(edge.to);
      }
    }

    return next;
  }

  async execute(initialState: WorkflowState): Promise<WorkflowState> {
    if (!this.entryNode) {
      throw new Error('No entry node defined in workflow graph');
    }

    let state: WorkflowState = { ...initialState, status: 'running', startTime: Date.now() };
    const executionQueue: string[] = [this.entryNode];
    const executed = new Set<string>();

    logger.info(`[Graph] Starting workflow execution: ${state.id}`);

    while (executionQueue.length > 0) {
      const currentNodeName = executionQueue.shift()!;

      if (executed.has(currentNodeName)) continue;

      const entry = this.nodes.get(currentNodeName);
      if (!entry) {
        logger.warn(`[Graph] Node "${currentNodeName}" not found, skipping`);
        continue;
      }

      // Check if agent should execute based on current state
      if (!entry.node.shouldExecute(state)) {
        logger.info(`[Graph] Skipping "${currentNodeName}" (condition not met)`);
        state.agentResults.push({
          agentName: currentNodeName,
          status: 'skipped',
          executionTimeMs: 0,
          warnings: [],
          errors: [],
          metadata: { reason: 'Condition not met' },
        });
        executed.add(currentNodeName);

        // Still add next nodes
        const nextNodes = this.getNextNodes(currentNodeName, state);
        executionQueue.push(...nextNodes);
        continue;
      }

      // Execute with retry logic
      state = await this.executeNodeWithRetry(entry, state);
      executed.add(currentNodeName);

      // Handle failure
      if (state.status === 'failed') {
        logger.error(`[Graph] Pipeline failed at "${currentNodeName}"`);
        break;
      }

      // Determine next nodes (conditional routing)
      const nextNodes = this.getNextNodes(currentNodeName, state);
      executionQueue.push(...nextNodes);
    }

    state.endTime = Date.now();
    state.totalExecutionTimeMs = state.endTime - state.startTime;

    if (state.status !== 'failed') {
      state.status = 'completed';
    }

    logger.info(`[Graph] Workflow completed in ${state.totalExecutionTimeMs}ms with status: ${state.status}`);

    return state;
  }

  private async executeNodeWithRetry(
    entry: GraphNodeEntry,
    state: WorkflowState
  ): Promise<WorkflowState> {
    const { node, retries } = entry;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const startTime = Date.now();
      state.currentAgent = node.name;

      logger.info(`[Graph] Executing "${node.name}" (attempt ${attempt}/${retries})`);

      try {
        state = await node.execute(state);

        const executionTime = Date.now() - startTime;
        state.agentResults.push({
          agentName: node.name,
          status: 'success',
          executionTimeMs: executionTime,
          warnings: [],
          errors: [],
          metadata: {},
        });

        logger.info(`[Graph] "${node.name}" completed in ${executionTime}ms`);
        return state;
      } catch (error) {
        lastError = error as Error;
        const executionTime = Date.now() - startTime;

        logger.error(`[Graph] "${node.name}" failed (attempt ${attempt}): ${lastError.message}`);

        if (attempt === retries) {
          state.agentResults.push({
            agentName: node.name,
            status: 'failed',
            executionTimeMs: executionTime,
            warnings: [],
            errors: [lastError.message],
            metadata: { attempts: attempt },
          });

          // Non-critical agents don't fail the pipeline
          if (this.isNonCritical(node.name)) {
            logger.warn(`[Graph] Non-critical agent "${node.name}" failed, continuing pipeline`);
            return state;
          }

          state.status = 'failed';
          state.error = `Agent "${node.name}" failed: ${lastError.message}`;
        }
      }
    }

    return state;
  }

  private isNonCritical(nodeName: string): boolean {
    const criticalNodes = ['input_processing', 'compression', 'validation'];
    return !criticalNodes.includes(nodeName);
  }
}
