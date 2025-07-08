import { EventEmitter } from 'events';
import {
  IToolExecutor,
  AIDecision,
  ExecutionResult,
  ToolChainStep,
  ToolChainResult,
  ExecutionResultMetadata,
  CoachingOutput,
  InterventionPriority,
  ExecutionStatus
} from './OrchestratorArchitecture.js';
import { ToolManager } from '../ToolManager.js';
import { SystemPromptManager } from './SystemPromptManager.js';
import { ToolExecutionResult } from '../interfaces/ITool.js';

/**
 * Execution result metadata
 */
interface ExecutionMetrics {
  totalTime: number;
  toolsUsed: string[];
  memoryAccessed: string[];
  confidence: number;
  successRate: number;
  retryCount: number;
}

interface ToolStepResult {
  stepId: string;
  toolName: string;
  success: boolean;
  output: any;
  executionTime: number;
  error?: any;
  metadata?: {
    memoryAccessed?: string[];
    executionTimeMs?: number;
    cached?: boolean;
    source?: string;
    usedFallback?: boolean;
    originalError?: string;
    fallbackTool?: string;
    [key: string]: any;
  };
}

interface ExtendedToolChainResult extends ToolChainResult {
  steps: ToolStepResult[];
}

/**
 * Tool execution implementation
 */
export class AIToolExecutor extends EventEmitter implements IToolExecutor {
  private toolManager: ToolManager;
  private systemPromptManager: SystemPromptManager;
  private activeExecutions: Map<string, {
    state: 'queued' | 'running' | 'completed' | 'failed';
    progress: number;
    startTime: number;
    currentStep: string | null;
    decision: AIDecision;
    toolChainProgress: Array<{
      stepId: string;
      toolName: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      startTime: number;
      endTime?: number;
      error?: any;
    }>;
  }>;
  private executionHistory: Map<string, ExecutionResult[]>;
  private resourceMonitor: Map<string, { usageCount: number; lastUsed: Date }>;

  private readonly maxConcurrentExecutions: number = 5;
  private readonly resourceLimits = {
    maxToolCalls: 30,
    maxProcessingTime: 30000, // 30 seconds
    maxMemoryQueries: 10,
    allowLLMCalls: true,
    allowTTSGeneration: true
  };

  constructor(toolManager: ToolManager, systemPromptManager: SystemPromptManager) {
    super();
    this.toolManager = toolManager;
    this.systemPromptManager = systemPromptManager;
    this.activeExecutions = new Map();
    this.executionHistory = new Map();
    this.resourceMonitor = new Map();
  }

  async executeDecision(decision: AIDecision): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = decision.id;

    try {
      // Check resource limits
      if (!this.checkResourceLimits(decision)) {
        throw new Error('Resource limits exceeded');
      }

      // Initialize execution tracking
      this.activeExecutions.set(executionId, {
        state: 'running',
        progress: 0,
        startTime,
        currentStep: null,
        decision,
        toolChainProgress: []
      });

      // Update resource monitoring
      this.updateResourceUsage(decision);

      // Execute tool chain with context
      const toolChainResult = await this.executeToolChain(decision.toolChain);

      const executionTime = Date.now() - startTime;
      const success = toolChainResult.successRate > 0.7;

      // Prepare execution result
      const result: ExecutionResult = {
        decisionId: decision.id,
        success,
        output: await this.formatOutput(decision, toolChainResult),
        toolResults: toolChainResult,
        metadata: {
          totalTime: executionTime,
          toolsUsed: toolChainResult.steps.map(s => s.toolName),
          memoryAccessed: toolChainResult.steps
            .filter(s => s.metadata?.memoryAccessed)
            .flatMap(s => s.metadata?.memoryAccessed || []),
          confidence: decision.confidence,
          gameState: decision.context.gameState
        }
      };

      // Update execution history
      this.updateExecutionHistory(executionId, result);

      // Cleanup
      this.activeExecutions.delete(executionId);
      return result;

    } catch (error) {
      // Handle execution failure
      const result = await this.handleExecutionFailure(executionId, decision, error as Error, startTime);
      this.activeExecutions.delete(executionId);
      return result;
    }
  }

  async executeToolChain(steps: ToolChainStep[]): Promise<ExtendedToolChainResult> {
    const results: ToolStepResult[] = [];
    let successCount = 0;
    const startTime = Date.now();

    for (const step of steps) {
      try {
        // Execute tool with timeout and retry logic
        const stepStartTime = Date.now();
        const result = await this.executeToolWithRetry(step.toolName, step.input, {
          timeout: step.timeout || 5000,
          maxRetries: step.retryPolicy?.maxRetries || 2,
          backoffStrategy: step.retryPolicy?.backoffStrategy || 'exponential'
        });

        // Record step result
        const stepResult: ToolStepResult = {
          stepId: step.stepId,
          toolName: step.toolName,
          success: true,
          output: result.data,
          executionTime: Date.now() - stepStartTime,
          error: null,
          metadata: result.metadata
        };
        results.push(stepResult);
        successCount++;

      } catch (error) {
        // Handle step failure
        const failureResult = await this.handleToolFailure(step, error as Error);
        const stepResult: ToolStepResult = {
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          output: null,
          executionTime: Date.now() - startTime,
          error: failureResult.error,
          metadata: failureResult.metadata
        };
        results.push(stepResult);

        // Break chain if critical tool failed
        if (step.dependencies.length > 0) {
          break;
        }
      }
    }

    return {
      steps: results,
      totalTime: Date.now() - startTime,
      successRate: successCount / steps.length
    };
  }

  private async executeToolWithRetry(
    toolName: string,
    input: any,
    options: {
      timeout: number;
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
    }
  ): Promise<ToolExecutionResult<any>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          this.toolManager.executeTool(toolName, input),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Tool execution timeout')), options.timeout)
          )
        ]);
        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < options.maxRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = options.backoffStrategy === 'exponential'
            ? Math.min(1000 * Math.pow(2, attempt), 10000)
            : 1000 * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Tool execution failed after retries');
  }

  async handleToolFailure(step: ToolChainStep, error: Error): Promise<ToolExecutionResult<any>> {
    const startTime = Date.now();
    // Try fallback tool if available
    if (step.fallbackTool) {
      try {
        const result = await this.toolManager.executeTool(step.fallbackTool, step.input);
        return {
          success: true,
          data: result,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            cached: false,
            source: step.fallbackTool,
            usedFallback: true,
            originalError: error.message,
            fallbackTool: step.fallbackTool
          }
        };
      } catch (fallbackError) {
        return this.createFailureResult(step, error, fallbackError as Error);
      }
    }

    return this.createFailureResult(step, error);
  }

  private createFailureResult(step: ToolChainStep, error: Error, fallbackError?: Error): ToolExecutionResult<any> {
    return {
      success: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: error.message,
        details: {
          stepId: step.stepId,
          toolName: step.toolName,
          fallbackAttempted: !!fallbackError,
          fallbackError: fallbackError?.message
        }
      }
    };
  }

  private async handleExecutionFailure(
    executionId: string,
    decision: AIDecision,
    error: Error,
    startTime: number
  ): Promise<ExecutionResult> {
    const result: ExecutionResult = {
      decisionId: decision.id,
      success: false,
      output: {
        id: `error_${executionId}`,
        type: 'error_correction',
        priority: InterventionPriority.LOW,
        title: 'Execution Error',
        message: 'Failed to execute coaching decision',
        details: error.message,
        actionItems: [],
        timing: { immediate: false, when: 'next_break' },
        personalization: {
          playerId: 'unknown',
          adaptedForStyle: false,
          confidenceLevel: 0
        }
      },
      toolResults: {
        steps: [],
        totalTime: Date.now() - startTime,
        successRate: 0
      },
      metadata: {
        totalTime: Date.now() - startTime,
        toolsUsed: [],
        memoryAccessed: [],
        confidence: 0,
        gameState: decision.context.gameState
      }
    };

    this.updateExecutionHistory(executionId, result);
    return result;
  }

  private async formatOutput(decision: AIDecision, toolChainResult: ExtendedToolChainResult): Promise<CoachingOutput> {
    // Find the last successful result that produced output
    const lastSuccessfulResult = toolChainResult.steps
      .reverse()
      .find(s => s.success && s.output?.text);

    return {
      id: decision.id,
      type: 'tactical_advice',
      priority: decision.priority,
      title: decision.rationale.split(' - ')[0],
      message: lastSuccessfulResult?.output?.text || 'Coaching advice generated',
      details: decision.rationale,
      actionItems: this.generateActionItems(toolChainResult, decision),
      timing: {
        immediate: decision.priority === InterventionPriority.IMMEDIATE,
        when: decision.priority === InterventionPriority.IMMEDIATE ? 'now' : 'next_round'
      },
      personalization: {
        playerId: decision.context.gameState.processed.playerState.steamId || 'unknown',
        adaptedForStyle: true,
        confidenceLevel: decision.confidence
      }
    };
  }

  private generateActionItems(toolChainResult: ExtendedToolChainResult, decision: AIDecision): string[] {
    const actionItems: string[] = [];

    // Add successful tool outputs as action items
    for (const step of toolChainResult.steps) {
      if (step.success && step.output?.actionItem) {
        actionItems.push(step.output.actionItem);
      }
    }

    // Add default action based on decision if no specific items
    if (actionItems.length === 0) {
      const firstTool = decision.toolChain[0]?.toolName;
      if (firstTool) {
        actionItems.push(`Follow guidance from ${firstTool}`);
      }
    }

    return actionItems;
  }

  private checkResourceLimits(decision: AIDecision): boolean {
    // Check concurrent executions
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      return false;
    }

    // Check tool call limits
    const totalToolCalls = decision.toolChain.length;
    if (totalToolCalls > this.resourceLimits.maxToolCalls) {
      return false;
    }

    // Check memory query limits
    const memoryQueries = decision.toolChain.filter(step =>
      step.toolName.includes('memory') || step.toolName.includes('Memory')
    ).length;
    if (memoryQueries > this.resourceLimits.maxMemoryQueries) {
      return false;
    }

    return true;
  }

  private updateResourceUsage(decision: AIDecision): void {
    for (const step of decision.toolChain) {
      const usage = this.resourceMonitor.get(step.toolName) || { usageCount: 0, lastUsed: new Date() };
      usage.usageCount++;
      usage.lastUsed = new Date();
      this.resourceMonitor.set(step.toolName, usage);
    }

    // Reset counters older than 1 minute
    for (const [tool, usage] of this.resourceMonitor.entries()) {
      if (Date.now() - usage.lastUsed.getTime() > 60000) {
        usage.usageCount = 0;
      }
    }
  }

  private updateExecutionHistory(executionId: string, result: ExecutionResult): void {
    const history = this.executionHistory.get(executionId) || [];
    history.push(result);
    this.executionHistory.set(executionId, history);

    // Limit history size
    if (history.length > 100) {
      history.shift();
    }
  }

  getExecutionStatus(decisionId: string): {
    state: 'queued' | 'running' | 'completed' | 'failed';
    progress: number;
    currentStep: string | null;
    toolChainProgress: any[];
  } {
    const execution = this.activeExecutions.get(decisionId);
    if (!execution) {
      return {
        state: 'queued',
        progress: 0,
        currentStep: null,
        toolChainProgress: []
      };
    }

    return {
      state: execution.state,
      progress: execution.progress,
      currentStep: execution.currentStep,
      toolChainProgress: execution.toolChainProgress
    };
  }

  getExecutionHistory(decisionId: string): ExecutionResult[] {
    return this.executionHistory.get(decisionId) || [];
  }

  getResourceUsage(): Map<string, { usageCount: number; lastUsed: Date }> {
    return new Map(this.resourceMonitor);
  }

  monitorExecution(decisionId: string): ExecutionStatus {
    const execution = this.activeExecutions.get(decisionId);
    if (!execution) {
      return {
        decisionId,
        state: 'queued',
        progress: 0,
        errors: []
      };
    }

    return {
      decisionId,
      state: execution.state,
      progress: execution.progress,
      currentStep: execution.currentStep || undefined,
      estimatedTimeRemaining: this.estimateRemainingTime(execution),
      errors: execution.toolChainProgress
        .filter(p => p.status === 'failed')
        .map(p => p.error)
    };
  }

  private estimateRemainingTime(execution: NonNullable<ReturnType<typeof this.activeExecutions.get>>): number {
    if (execution.state === 'completed' || execution.state === 'failed') {
      return 0;
    }

    const elapsedTime = Date.now() - execution.startTime;
    const completedSteps = execution.toolChainProgress.filter(p => p.status === 'completed').length;
    const totalSteps = execution.decision.toolChain.length;

    if (completedSteps === 0) {
      return totalSteps * 5000; // Assume 5 seconds per step
    }

    const averageStepTime = elapsedTime / completedSteps;
    return Math.round((totalSteps - completedSteps) * averageStepTime);
  }
} 