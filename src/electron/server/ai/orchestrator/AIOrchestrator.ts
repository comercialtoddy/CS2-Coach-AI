/**
 * Main AI Orchestrator Implementation
 * 
 * This is the central coordinator that manages the entire AI coaching workflow.
 * It integrates all components: GSI data processing, state management, decision making,
 * tool execution, and output formatting to provide intelligent real-time coaching.
 */

import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import {
  PlayerProfileData,
  SessionData,
  GameKnowledgeType,
  GameKnowledgeData,
  PlayerProfileMemory,
  SessionDataMemory,
  CoachingInsightsMemory,
  GameKnowledgeMemory,
  BaseMemoryEntry,
  MemoryType,
  MemoryImportance
} from '../interfaces/MemoryService.js';
import {
  IOrchestrator,
  IInputHandler,
  IStateManager,
  IDecisionEngine,
  IToolExecutor,
  IOutputFormatter,
  ProcessingState,
  GameStateSnapshot,
  AIDecisionContext,
  AIDecision,
  ExecutionResult,
  ExecutionResultMetadata,
  UserFeedback,
  ExecutionOutcome,
  CoachingOutput,
  OrchestratorConfig,
  OrchestratorStats,
  OrchestratorHealth,
  SystemIntegration,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ResourceLimits,
  InterventionPriority,
  CoachingObjective,
  GameContext,
  ToolChainStep,
  ToolChainResult,
  ExecutionStatus,
  PlayerGameState,
  TeamGameState,
  MapGameState,
  EconomyState,
  SituationalFactor
} from './OrchestratorArchitecture.js';
import { GSIInputHandler } from './GSIDataModel.js';
import { DynamicStateManager } from './StateManager.js';
import { GSIDecisionEngine } from './DecisionEngine.js';
import { SystemPromptManager, CoachingPersonality, ContextMode } from './SystemPromptManager.js';
import { ToolManager } from '../ToolManager.js';
import { ToolExecutionResult } from '../interfaces/ITool.js';
import { MemoryService } from '../memory/MemoryService.js';
import { MemoryQueryOptions, MemoryRetrievalResult } from '../interfaces/MemoryService.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execution result metadata
 */
// Removed local interface - using imported one from OrchestratorArchitecture

// Using imported types from MemoryService.js

/**
 * Tool execution implementation
 */
class AIToolExecutor implements IToolExecutor {
  private toolManager: ToolManager;
  private systemPromptManager: SystemPromptManager;
  private activeExecutions: Map<string, any>;
  private executionHistory: Map<string, ExecutionResult[]>;
  private resourceMonitor: Map<string, { usageCount: number, lastUsed: Date }>;
  private readonly maxConcurrentExecutions: number = 5;
  private readonly resourceLimits: ResourceLimits = {
    maxToolCalls: 30,
    maxProcessingTime: 30000,
    maxMemoryQueries: 10,
    allowLLMCalls: true,
    allowTTSGeneration: true
  };

  constructor(toolManager: ToolManager, systemPromptManager: SystemPromptManager) {
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

      // Generate system prompt context if needed
      const systemPrompt = await this.systemPromptManager.generatePrompt(
        {
          timestamp: new Date(),
          gameState: decision.context.gameState,
          playerMemory: decision.context.playerMemory,
          sessionSummary: {
            duration: 0,
            keyEvents: [],
            performanceMetrics: {},
            learningOpportunities: []
          },
          coachingObjectives: decision.context.coachingObjectives,
          playerPreferences: {
            communicationStyle: 'direct',
            feedbackFrequency: 'moderate',
            focusAreas: [],
            avoidTopics: []
          },
          dynamicContext: {
            recentPerformance: '',
            emotionalState: 'neutral',
            attentionLevel: 'normal',
            receptiveness: 0.8
          }
        },
        decision.context.coachingObjectives
      );

      // Execute tool chain with context
      const toolChainResult = await this.executeToolChain(decision.toolChain);
      
      const executionTime = Date.now() - startTime;
      const success = toolChainResult.successRate > 0.7;

      // Prepare execution result
      const result: ExecutionResult = {
        decisionId: decision.id,
        success,
        output: await this.formatToolChainOutput(decision, toolChainResult, systemPrompt),
        toolResults: toolChainResult,
        metadata: {
          totalTime: executionTime,
          toolsUsed: toolChainResult.steps.map((s: any) => s.toolName),
          memoryAccessed: toolChainResult.steps
            .filter((s: any) => s.metadata?.memoryAccessed)
            .flatMap((s: any) => s.metadata.memoryAccessed),
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

  async executeToolChain(steps: ToolChainStep[]): Promise<ToolChainResult> {
    const results: Array<{
      stepId: string;
      toolName: string;
      success: boolean;
      output: any;
      executionTime: number;
      error: any;
      metadata?: any;
    }> = [];
    let successCount = 0;
    const startTime = Date.now();

    for (const step of steps) {
      try {
        // Execute tool with timeout and retry logic
        const stepStartTime = Date.now();
        const result = await this.executeToolWithRetry(step.toolName, step.input, {
          timeout: step.timeout,
          maxRetries: step.retryPolicy.maxRetries,
          backoffStrategy: step.retryPolicy.backoffStrategy
        });

        // Record step result
        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: true,
          output: result.data,
          executionTime: Date.now() - stepStartTime,
          error: null,
          metadata: result.metadata
        });
        successCount++;

      } catch (error) {
        // Handle step failure
        const failureResult = await this.handleToolFailure(step, error as Error);
        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          output: null,
          executionTime: Date.now() - startTime,
          error: failureResult.error,
          metadata: failureResult.metadata
        });
        
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
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
      try {
        return await Promise.race([
          this.toolManager.executeTool(toolName, input),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), options.timeout)
          )
        ]);
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
        id: uuidv4(),
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

  monitorExecution(decisionId: string): ExecutionStatus {
    const execution = this.activeExecutions.get(decisionId);
    if (!execution) {
      return { 
        decisionId,
        state: 'queued',
        progress: 0,
        errors: ['Execution not found']
      };
    }

    return {
      decisionId,
      state: execution.state,
      progress: execution.progress,
      currentStep: execution.currentStep,
      estimatedTimeRemaining: Math.max(0, this.resourceLimits.maxProcessingTime - (Date.now() - execution.startTime)),
      errors: []
    };
  }

  private async formatToolChainOutput(
    decision: AIDecision,
    toolChainResult: ToolChainResult,
    systemPrompt: any
  ): Promise<CoachingOutput> {
    // Find the last successful result that produced output
    const lastSuccessfulResult = toolChainResult.steps
      .reverse()
      .find(s => s.success && s.output?.text);
    
    return {
      id: uuidv4(),
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

  private generateActionItems(toolChainResult: ToolChainResult, decision: AIDecision): string[] {
    const actionItems: string[] = [];

    // Add successful tool outputs as action items
    for (const step of toolChainResult.steps) {
      if (step.success && step.output?.actionItem) {
        actionItems.push(step.output.actionItem);
      }
    }

    // Add default action based on decision if no specific items
    if (actionItems.length === 0) {
      actionItems.push(`Follow guidance from ${decision.toolChain[0]?.toolName}`);
    }

    return actionItems;
  }
}

/**
 * Output formatting implementation
 */
class AIOutputFormatter implements IOutputFormatter {
  formatCoachingAdvice(result: ExecutionResult): CoachingOutput {
    return result.output;
  }

  generateAudioScript(advice: CoachingOutput): any {
    return {
      text: advice.message,
      voice: 'en_US-ryan-medium',
      speed: 1.0,
      emphasis: [],
      metadata: {
        duration: advice.message.length * 0.1, // Rough estimate
        priority: advice.priority
      }
    };
  }

  formatVisualFeedback(advice: CoachingOutput): any {
    return {
      overlay: {
        enabled: advice.timing.immediate,
        position: 'center',
        duration: 5000
      },
      indicators: [],
      hud: {
        showStats: true,
        showAdvice: true,
        showProgress: false
      }
    };
  }

  personalizeOutput(output: CoachingOutput, playerProfile: any): CoachingOutput {
    // Personalization logic would go here
    return output;
  }
}

/**
 * Main AI Orchestrator implementation
 */
export class AIOrchestrator extends EventEmitter implements IOrchestrator {
  private inputHandler: IInputHandler;
  private stateManager: IStateManager;
  private decisionEngine: IDecisionEngine;
  private toolExecutor: IToolExecutor;
  private outputFormatter: IOutputFormatter;
  private systemPromptManager: SystemPromptManager;
  private memoryService: MemoryService;
  private toolManager: ToolManager;
  
  private config: OrchestratorConfig;
  private processingState: ProcessingState;
  private activeDecisions: Map<string, AIDecision>;
  private stats: OrchestratorStats;
  private isRunning: boolean;
  private lastGSIUpdate: Date;
  private healthStatus: OrchestratorHealth;
  private healthCheckInterval: NodeJS.Timeout | null;

  constructor(integration: SystemIntegration, config?: Partial<OrchestratorConfig>) {
    super();
    
    // Initialize configuration
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    
    // Initialize core components
    this.toolManager = integration.toolManager;
    this.memoryService = integration.memoryService;
    
    this.inputHandler = new GSIInputHandler();
    this.stateManager = new DynamicStateManager({}, this.memoryService);
    this.decisionEngine = new GSIDecisionEngine(this.toolManager);
    this.systemPromptManager = new SystemPromptManager(this.memoryService);
    this.toolExecutor = new AIToolExecutor(this.toolManager, this.systemPromptManager);
    this.outputFormatter = new AIOutputFormatter();
    
    // Initialize state
    this.processingState = ProcessingState.IDLE;
    this.activeDecisions = new Map();
    this.isRunning = false;
    this.lastGSIUpdate = new Date();
    this.healthCheckInterval = null;
    
    // Initialize stats
    this.stats = {
      totalGSIUpdates: 0,
      totalDecisions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDecisionTime: 0,
      averageExecutionTime: 0,
      memoryHitRate: 0,
      toolUsageStats: {},
      playerSatisfactionScore: 3.5
    };

    // Initialize health status
    this.healthStatus = {
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {
        gsiLag: 0,
        activeDecisions: 0,
        staleDecisions: 0,
        successRate: 1,
        averageExecutionTime: 0,
        errorCount: 0
      }
    };

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for component coordination
   */
  private setupEventHandlers(): void {
    // Decision engine events
    (this.decisionEngine as GSIDecisionEngine).on('analysis-started', (data: any) => {
      this.emit('decision-analysis-started', data);
    });

    (this.decisionEngine as GSIDecisionEngine).on('analysis-completed', (data: any) => {
      this.emit('decision-analysis-completed', data);
    });

    (this.decisionEngine as GSIDecisionEngine).on('analysis-error', (data: any) => {
      this.emit('error', new Error(`Decision analysis error: ${data.error}`));
    });

    // State manager events
    (this.stateManager as DynamicStateManager).on('state-updated', (snapshot: any) => {
      this.emit('gsi-update', snapshot);
    });

    (this.stateManager as DynamicStateManager).on('pattern-detected', (pattern: any) => {
      this.emit('pattern-detected', pattern);
    });

    // System prompt manager events
    this.systemPromptManager.on('prompt-generated', (data) => {
      this.emit('system-prompt-generated', data);
    });

    this.systemPromptManager.on('personality-changed', (data) => {
      this.emit('coaching-personality-changed', data);
    });

    this.systemPromptManager.on('templates-initialized', (data) => {
      this.emit('prompt-templates-ready', data);
    });
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(config?: Partial<OrchestratorConfig>): Promise<void> {
    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Initialize components
      await this.stateManager.loadState();
      
      this.emit('initialized', { config: this.config });
    } catch (error) {
      this.emit('error', new Error(`Initialization failed: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    try {
      // Initialize components
      await this.initialize();

      // Set running state
      this.isRunning = true;
      this.setProcessingState(ProcessingState.IDLE);

      // Start health check interval
      this.startHealthCheck();

      this.emit('started');

    } catch (error) {
      this.handleProcessingError('STARTUP_ERROR', error as Error);
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Cancel any active decisions
      for (const [decisionId, decision] of this.activeDecisions.entries()) {
        await this.handleDecisionError(decision, new Error('Orchestrator stopping'));
        this.activeDecisions.delete(decisionId);
      }

      // Update state
      this.isRunning = false;
      this.setProcessingState(ProcessingState.STOPPED);

      this.emit('stopped');

    } catch (error) {
      this.handleProcessingError('SHUTDOWN_ERROR', error as Error);
      throw error;
    }
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }

  /**
   * Process GSI update - main entry point for real-time data
   */
  async processGSIUpdate(gsiData: CSGO): Promise<void> {
    if (!this.isRunning || this.processingState === ProcessingState.ERROR) {
      return;
    }

    try {
      // Update last GSI timestamp
      this.lastGSIUpdate = new Date();

      // Process GSI data into game state
      const gameState = await this.inputHandler.processGSIUpdate(gsiData);

      // Check if we should generate decisions
      if (!this.shouldGenerateDecisions(gameState)) {
        return;
      }

      // Set processing state
      this.setProcessingState(ProcessingState.PROCESSING);

      // Generate and execute decisions
      await this.generateAndExecuteDecisions(gameState);

      // Reset processing state
      this.setProcessingState(ProcessingState.IDLE);

    } catch (error) {
      this.handleProcessingError('GSI_PROCESSING_ERROR', error as Error);
    }
  }

  /**
   * Main decision generation and execution flow
   */
  private async generateAndExecuteDecisions(gameState: GameStateSnapshot): Promise<void> {
    try {
      this.setProcessingState(ProcessingState.PROCESSING);
      const startTime = Date.now();

      // Prepare decision context with system prompt and contextual input
      const context = await this.prepareDecisionContext(gameState);

      // Generate decisions using the enhanced context
      const decisions = await this.decisionEngine.generateDecisions(context);

      // Execute each decision with the enhanced context
      for (const decision of decisions) {
        await this.executeDecisionAsync(decision);
      }

      // Update stats
      this.updateDecisionStats(Date.now() - context.timestamp.getTime());

    } catch (error) {
      this.handleProcessingError('DECISION_GENERATION_ERROR', error as Error);
    } finally {
      this.setProcessingState(ProcessingState.IDLE);
    }
  }

  /**
   * Prepare context for decision making
   */
  private async prepareDecisionContext(gameState: GameStateSnapshot): Promise<AIDecisionContext> {
    // Build basic contextual input
    const contextualInput = await this.buildContextualInputForPrompt(gameState);

    // Determine coaching objectives based on game state
    const coachingObjectives = this.determineCoachingObjectives(gameState);

    // Generate system prompt with context
    const systemPrompt = await this.systemPromptManager.generatePrompt(
      contextualInput,
      coachingObjectives,
      {
        contextMode: ContextMode.ADAPTIVE,
        urgencyOverride: this.calculateUrgency(gameState)
      }
    );

    // Prepare memory context
    const playerMemory = await this.memoryService.query({
      type: MemoryType.PLAYER_PROFILE
    });

    // Return complete decision context
    return {
      gameState,
      systemPrompt,
      playerMemory: playerMemory.entries,
      coachingObjectives,
      timestamp: new Date(),
      contextualInput
    };
  }

  /**
   * Determine coaching objectives based on game state
   */
  private determineCoachingObjectives(gameState: GameStateSnapshot): CoachingObjective[] {
    const objectives: CoachingObjective[] = [];
    const player = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    // Check player state
    if (player.health < 50) {
      objectives.push(CoachingObjective.TACTICAL_GUIDANCE);
    }

    if (player.statistics.deaths > player.statistics.kills) {
      objectives.push(CoachingObjective.PERFORMANCE_IMPROVEMENT);
    }

    // Check team state
    const teamState = gameState.processed.teamState;
    if (teamState.communication.activity < 0.5) {
      objectives.push(CoachingObjective.TEAM_COORDINATION);
    }

    // Check situational factors
    for (const factor of situationalFactors) {
      switch (factor.type) {
        case 'tactical':
          if (factor.severity === 'high' || factor.severity === 'critical') {
            objectives.push(CoachingObjective.TACTICAL_GUIDANCE);
          }
          break;
        case 'psychological':
          if (factor.severity === 'high') {
            objectives.push(CoachingObjective.MENTAL_COACHING);
          }
          break;
        case 'economic':
          if (factor.severity === 'high' || factor.severity === 'critical') {
            objectives.push(CoachingObjective.STRATEGIC_ANALYSIS);
          }
          break;
      }
    }

    // Check for learning opportunities
    if (gameState.processed.context === GameContext.LEARNING_OPPORTUNITY) {
      objectives.push(CoachingObjective.SKILL_DEVELOPMENT);
    }

    // Add error correction if needed
    if (objectives.length === 0) {
      objectives.push(CoachingObjective.ERROR_CORRECTION);
    }

    return Array.from(new Set(objectives)); // Remove duplicates
  }

  /**
   * Execute a single decision
   */
  private async executeDecisionAsync(decision: AIDecision): Promise<void> {
    try {
      // Execute the decision with the enhanced context
      const result = await this.toolExecutor.executeDecision(decision);

      // Evaluate the outcome
      const outcome = await this.evaluateExecutionOutcome(decision, result);

      // Update memory with the outcome
      await this.updateMemoryFromOutcome(decision, outcome, decision.context.gameState);

      // Update system prompt manager with feedback
      this.systemPromptManager.updateFromFeedback(decision.context.systemPrompt.id, {
        rating: outcome.success ? 5 : 3,
        effectiveness: outcome.impact,
        appropriateness: outcome.relevance,
        suggestions: outcome.learningPoints.join(', ')
      });

      // Emit outcome event
      this.emit('decision-executed', { decision, result, outcome });

    } catch (error) {
      this.handleDecisionError(decision, error as Error);
    }
  }

  /**
   * Evaluate execution outcome for learning
   */
  private async evaluateExecutionOutcome(
    decision: AIDecision,
    result: ExecutionResult
  ): Promise<ExecutionOutcome> {
    const success = result.success;
    const impact = this.calculateDecisionImpact(decision, result);
    const relevance = this.assessDecisionRelevance(decision);
    const learningPoints = this.extractLearningPoints(result);

    return {
      decisionId: decision.id,
      success,
      impact,
      relevance,
      learningPoints,
      timestamp: new Date(),
      playerResponse: 'neutral',
      measuredImpact: {
        performance: impact * 0.8,
        engagement: impact * 0.6,
        learning: impact * 0.7
      },
      followUpRequired: !success || impact < 0.5,
      metadata: {
        executionTime: result.metadata.totalTime,
        toolsUsed: result.metadata.toolsUsed,
        confidence: decision.confidence
      }
    };
  }

  private calculateDecisionImpact(decision: AIDecision, result: ExecutionResult): number {
    // Calculate impact based on decision type and result
    let impact = 0;

    switch (decision.type) {
      case 'positioning':
        impact = this.calculatePositioningImpact(decision, result);
        break;
      case 'economy':
        impact = this.calculateEconomyImpact(decision, result);
        break;
      case 'performance':
        impact = this.calculatePerformanceImpact(decision, result);
        break;
      default:
        impact = result.success ? 0.7 : 0.3;
    }

    return Math.min(1, Math.max(0, impact));
  }

  private calculatePositioningImpact(decision: AIDecision, result: ExecutionResult): number {
    const playerState = decision.context.gameState.processed.playerState;
    const gamePhase = decision.context.gameState.processed.phase;

    // Higher impact for successful positioning in critical situations
    if (gamePhase === 'clutch' && result.success) {
      return 0.9;
    }

    // Medium impact for general positioning improvements
    if (playerState.health > 0 && result.success) {
      return 0.7;
    }

    return result.success ? 0.5 : 0.2;
  }

  private calculateEconomyImpact(decision: AIDecision, result: ExecutionResult): number {
    const gamePhase = decision.context.gameState.processed.phase;
    const economyState = decision.context.gameState.processed.economyState;

    // Higher impact for successful economy management in critical rounds
    if (economyState.teamAdvantage === 'disadvantage' && result.success) {
      return 0.9;
    }

    // Medium impact for general economy decisions
    if (gamePhase === 'freezetime' && result.success) {
      return 0.7;
    }

    return result.success ? 0.5 : 0.2;
  }

  private calculatePerformanceImpact(decision: AIDecision, result: ExecutionResult): number {
    const gamePhase = decision.context.gameState.processed.phase;
    const situationalFactors = decision.context.gameState.processed.situationalFactors;

    // Higher impact for performance analysis after critical rounds
    const isClutch = situationalFactors.some(f => f.type === 'clutch' && f.severity === 'critical');
    if (gamePhase === 'round_end' || isClutch) {
      return result.success ? 0.9 : 0.4;
    }

    // Medium impact for general performance analysis
    return result.success ? 0.6 : 0.3;
  }

  private assessDecisionRelevance(decision: AIDecision): number {
    const gameState = decision.context.gameState;
    const gamePhase = gameState.processed.phase;
    const playerState = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    // Base relevance on timing and context
    let relevance = 0.5;

    // Adjust based on game context
    const isCritical = situationalFactors.some(f => f.severity === 'critical');
    if (isCritical) {
      relevance += 0.3;
    }

    // Adjust based on player state
    const isAlive = playerState.health > 0;
    const isInCombat = playerState.health > 0 && playerState.health < 100;
    if (isAlive && isInCombat) {
      relevance += 0.2;
    }

    // Adjust based on decision priority
    switch (decision.priority) {
      case InterventionPriority.IMMEDIATE:
        relevance += 0.2;
        break;
      case InterventionPriority.HIGH:
        relevance += 0.1;
        break;
      case InterventionPriority.LOW:
        relevance -= 0.1;
        break;
    }

    return Math.min(1, Math.max(0, relevance));
  }

  private extractLearningPoints(result: ExecutionResult): string[] {
    const learningPoints: string[] = [];

    // Extract learning points from tool results
    result.toolResults.steps.forEach(step => {
      if (step.success && step.output?.learningPoints) {
        learningPoints.push(...step.output.learningPoints);
      }
    });

    // Add general learning point if none found
    if (learningPoints.length === 0) {
      learningPoints.push(result.success ? 
        'Successfully executed coaching decision' :
        'Identified area for improvement in coaching approach'
      );
    }

    return learningPoints;
  }

  /**
   * Error handling for processing errors
   */
  private handleProcessingError(code: string, error: Error): void {
    // Update health status
    this.healthStatus = {
      status: 'error',
      lastCheck: new Date(),
      lastError: {
        code,
        message: error.message,
        timestamp: new Date()
      },
      metrics: {
        ...this.healthStatus.metrics,
        errorCount: (this.healthStatus.metrics.errorCount || 0) + 1
      }
    };

    // Set error state
    this.setProcessingState(ProcessingState.ERROR);

    // Log error
    console.error(`[AIOrchestrator] ${code}:`, error);

    // Emit error event
    this.emit('error', { code, error });

    // Try to recover based on error type
    switch (code) {
      case 'STARTUP_ERROR':
        // Fatal error, cannot recover
        break;

      case 'GSI_PROCESSING_ERROR':
        // Wait for next GSI update
        setTimeout(() => {
          if (this.isRunning) {
            this.setProcessingState(ProcessingState.IDLE);
          }
        }, 5000);
        break;

      case 'DECISION_GENERATION_ERROR':
        // Clear active decisions and reset state
        this.activeDecisions.clear();
        this.setProcessingState(ProcessingState.IDLE);
        break;

      case 'DECISION_EXECUTION_ERROR':
        // Individual decision errors handled by handleDecisionError
        break;

      default:
        // Unknown error, try to reset to idle state
        if (this.isRunning) {
          this.setProcessingState(ProcessingState.IDLE);
        }
    }
  }

  /**
   * Error handling for decision execution errors
   */
  private handleDecisionError(decision: AIDecision, error: Error): void {
    // Log error
    console.error(`[AIOrchestrator] Decision execution error (${decision.id}):`, error);

    // Update stats
    this.stats.failedExecutions++;

    // Emit error event
    this.emit('decision-error', {
      decisionId: decision.id,
      error: {
        message: error.message,
        stack: error.stack
      },
      context: {
        type: decision.type,
        priority: decision.priority,
        gameState: decision.context.gameState
      }
    });

    // Handle based on priority
    if (decision.priority === InterventionPriority.IMMEDIATE || 
        decision.priority === InterventionPriority.HIGH) {
      // Critical decision failed, pause processing
      this.setProcessingState(ProcessingState.PAUSED);

      // Try to recover after delay
      setTimeout(() => {
        if (this.isRunning) {
          this.setProcessingState(ProcessingState.IDLE);
        }
      }, 10000);
    }
  }

  /**
   * Check if we should generate new decisions
   */
  private shouldGenerateDecisions(gameState: GameStateSnapshot): boolean {
    // Skip if too many active decisions
    if (this.activeDecisions.size >= this.config.processing.maxConcurrentDecisions) {
      return false;
    }

    // Skip if no significant state change
    if (!this.hasSignificantStateChange(gameState)) {
      return false;
    }

    // Skip if processing is paused or in error state
    if (this.processingState === ProcessingState.PAUSED || 
        this.processingState === ProcessingState.ERROR) {
      return false;
    }

    return true;
  }

  /**
   * Check for significant changes in game state
   */
  private hasSignificantStateChange(gameState: GameStateSnapshot): boolean {
    const gamePhase = gameState.processed.phase;
    const playerState = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    // Always process on round state changes
    if (gamePhase === 'round_start' || gamePhase === 'round_end') {
      return true;
    }

    // Process on significant player events
    const prevHealth = playerState.health;
    if (prevHealth === 0 || prevHealth === 100) {
      return true;
    }

    // Process on combat events
    const isInCombat = playerState.health > 0 && playerState.health < 100;
    const hasCombatNearby = situationalFactors.some(f => f.type === 'tactical' && f.severity === 'high');
    if (isInCombat || hasCombatNearby) {
      return true;
    }

    // Process on economy events
    if (gamePhase === 'freezetime') {
      return true;
    }

    // Process on critical situations
    const isCritical = situationalFactors.some(f => f.severity === 'critical');
    const isClutch = situationalFactors.some(f => f.type === 'clutch');
    if (isCritical || isClutch) {
      return true;
    }

    return false;
  }

  /**
   * Update decision-related statistics
   */
  private updateDecisionStats(totalTime: number): void {
    const { totalDecisions } = this.stats;
    
    // Update average decision time
    this.stats.averageDecisionTime = totalDecisions === 1
      ? totalTime
      : (this.stats.averageDecisionTime * (totalDecisions - 1) + totalTime) / totalDecisions;

    // Update average execution time
    const successRate = this.stats.successfulExecutions / totalDecisions;
    this.stats.averageExecutionTime = (
      this.stats.averageExecutionTime * (totalDecisions - 1) + totalTime
    ) / totalDecisions;

    // Update tool usage stats
    const activeTools = Array.from(this.toolExecutor.monitorExecution('').errors);
    activeTools.forEach(tool => {
      this.stats.toolUsageStats[tool] = (this.stats.toolUsageStats[tool] || 0) + 1;
    });
  }

  /**
   * Set processing state and emit event
   */
  private setProcessingState(state: ProcessingState): void {
    this.processingState = state;
    this.emit('state-changed', state);
  }

  /**
   * Handle user commands
   */
  async handleUserCommand(command: string, data?: any): Promise<void> {
    try {
      switch (command) {
        case 'force_analysis':
          await this.forceAnalysis();
          break;
        case 'clear_memory':
          await this.memoryService.clearMemory();
          break;
        case 'update_config':
          this.updateConfig(data);
          break;
        case 'get_health':
          await this.performHealthCheck();
          break;
        default:
          this.emit('error', new Error(`Unknown command: ${command}`));
      }
    } catch (error) {
      this.emit('error', new Error(`Command execution failed: ${(error as Error).message}`));
    }
  }

  /**
   * Handle user feedback
   */
  async handleUserFeedback(feedback: UserFeedback): Promise<void> {
    try {
      // Pass feedback to decision engine for learning
      this.decisionEngine.adaptToFeedback(feedback);
      
      // Update stats
      this.updatePlayerSatisfaction(feedback.rating);
      
      this.emit('user-feedback', feedback);
    } catch (error) {
      this.emit('error', new Error(`Feedback processing failed: ${(error as Error).message}`));
    }
  }

  /**
   * Get current state
   */
  getCurrentState(): GameStateSnapshot | null {
    return this.stateManager.getCurrentState();
  }

  /**
   * Get processing state
   */
  getProcessingState(): ProcessingState {
    return this.processingState;
  }

  /**
   * Get active decisions
   */
  getActiveDecisions(): AIDecision[] {
    return Array.from(this.activeDecisions.values());
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  /**
   * Get configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /**
   * Get health status
   */
  getHealthStatus(): OrchestratorHealth {
    return { ...this.healthStatus };
  }

  /**
   * Set coaching personality
   */
  setCoachingPersonality(personality: CoachingPersonality): void {
    this.systemPromptManager.setActivePersonality(personality);
    this.emit('coaching-personality-changed', { personality });
  }

  /**
   * Get coaching personality
   */
  getCoachingPersonality(): CoachingPersonality {
    return this.systemPromptManager.getActivePersonality();
  }

  /**
   * Generate system prompt for current context
   */
  async generateSystemPrompt(
    gameState: GameStateSnapshot,
    coachingObjectives: CoachingObjective[]
  ): Promise<any> {
    try {
      // Build contextual input
      const contextualInput = await this.buildContextualInputForPrompt(gameState);
      
      // Generate prompt
      const generatedPrompt = await this.systemPromptManager.generatePrompt(
        contextualInput,
        coachingObjectives
      );

      this.emit('system-prompt-ready', {
        promptId: generatedPrompt.id,
        personality: generatedPrompt.personality,
        contextMode: generatedPrompt.contextMode,
        urgency: generatedPrompt.metadata.urgency
      });

      return generatedPrompt;
    } catch (error) {
      this.emit('error', new Error(`System prompt generation failed: ${(error as Error).message}`));
      throw error;
    }
  }

  /**
   * Update system prompt manager configuration
   */
  updateSystemPromptConfig(updates: any): void {
    this.systemPromptManager.updateConfig(updates);
  }

  /**
   * Get system prompt metrics and history
   */
  getSystemPromptMetrics(): {
    personalityMetrics: Map<CoachingPersonality, any>;
    promptHistory: any[];
    config: any;
  } {
    return {
      personalityMetrics: this.systemPromptManager.getPersonalityMetrics(),
      promptHistory: this.systemPromptManager.getPromptHistory(10),
      config: this.systemPromptManager.getConfig()
    };
  }

  // ===== Private Methods =====

  /**
   * Build contextual input for system prompt generation
   */
  private async buildContextualInputForPrompt(gameState: GameStateSnapshot): Promise<any> {
    // Get relevant memory entries
    const playerMemoryResult = await this.memoryService.searchMemory({
      query: `player:${gameState.processed.playerState.steamId}`,
      limit: 10
    });

    const sessionHistoryResult = await this.memoryService.searchMemory({
      query: 'session:current',
      limit: 20
    });

    const playerMemory = playerMemoryResult.entries;
    const sessionHistory = sessionHistoryResult.entries;

    // Calculate session duration and key events
    const sessionDuration = Date.now() - (this.stats.totalGSIUpdates > 0 ? Date.now() - 600000 : Date.now());
    const keyEvents = this.extractKeyEventsFromMemory(sessionHistory);
    
    // Analyze player emotional state and performance
    const recentPerformance = this.analyzeRecentPerformance(gameState);
    const emotionalState = this.inferEmotionalState(gameState, playerMemory);

    return {
      timestamp: new Date(),
      gameState,
      playerMemory,
      sessionSummary: {
        duration: sessionDuration,
        keyEvents,
        performanceMetrics: {
          adr: gameState.processed.playerState.statistics.adr,
          rating: gameState.processed.playerState.statistics.rating,
          kd: gameState.processed.playerState.statistics.kills / Math.max(1, gameState.processed.playerState.statistics.deaths)
        },
        learningOpportunities: this.identifyLearningOpportunities(gameState)
      },
      coachingObjectives: this.determineCoachingObjectives(gameState),
      playerPreferences: {
        communicationStyle: 'balanced',
        feedbackFrequency: 'moderate',
        focusAreas: ['aim', 'positioning', 'economy'],
        avoidTopics: []
      },
      dynamicContext: {
        recentPerformance,
        emotionalState,
        attentionLevel: this.calculateAttentionLevel(gameState),
        receptiveness: this.calculateReceptiveness(gameState, emotionalState)
      }
    };
  }

  /**
   * Extract key events from session memory
   */
  private extractKeyEventsFromMemory(sessionHistory: BaseMemoryEntry[]): string[] {
    return sessionHistory
      .filter(entry => entry.metadata?.isKeyEvent)
      .map(entry => (entry.content ?? '').substring(0, 50))
      .slice(0, 5);
  }

  /**
   * Analyze recent performance trends
   */
  private analyzeRecentPerformance(gameState: GameStateSnapshot): string {
    const player = gameState.processed.playerState;
    const rating = player.statistics.rating;
    
    if (rating > 1.2) return 'excellent';
    if (rating > 1.0) return 'above_average';
    if (rating > 0.8) return 'average';
    if (rating > 0.6) return 'below_average';
    return 'struggling';
  }

  /**
   * Infer emotional state from game data and memory
   */
  private inferEmotionalState(gameState: GameStateSnapshot, memory: BaseMemoryEntry[]): string {
    const player = gameState.processed.playerState;
    const team = gameState.processed.teamState;
    const map = gameState.processed.mapState;
    const situationalFactors = gameState.processed.situationalFactors;

    // Performance-based emotional indicators
    const performanceIndicators = {
      recentDeaths: player.statistics.deaths,
      killDeathRatio: player.statistics.kills / Math.max(player.statistics.deaths, 1),
      damageOutput: player.statistics.adr,
      roundImpact: this.calculateRoundImpact(player, gameState),
      isUnderperforming: this.isUnderperforming(player, memory)
    };

    // Team-based emotional indicators
    const teamIndicators = {
      isTeamWinning: team.score > (map.round / 2),
      recentTeamPerformance: this.analyzeRecentTeamPerformance(gameState, memory),
      communicationQuality: team.communication.activity,
      teamCoordination: team.communication.coordination
    };

    // Situational stress indicators
    const stressIndicators = {
      isClutchSituation: this.isClutchSituation(gameState),
      isEconomyPressure: this.isEconomyStressed(gameState),
      isTimeConstraint: gameState.processed.timeRemaining && gameState.processed.timeRemaining < 20,
      isCriticalRound: this.isCriticalRound(gameState)
    };

    // Analyze recent memory entries for emotional patterns
    const recentEmotionalMemory = memory
      .filter(entry => entry.metadata?.emotionalIndicators?.length > 0)
      .slice(0, 5); // Last 5 emotional states

    // Calculate emotional state based on all factors
    let emotionalState = this.calculateEmotionalState(
      performanceIndicators,
      teamIndicators,
      stressIndicators,
      recentEmotionalMemory
    );

    // Add situational context
    const situationalContext = situationalFactors
      .filter(factor => factor.severity === 'high' || factor.severity === 'critical')
      .map(factor => factor.type);

    if (situationalContext.length > 0) {
      emotionalState = this.adjustEmotionalStateForContext(emotionalState, situationalContext);
    }

    return emotionalState;
  }

  /**
   * Calculate round impact score
   */
  private calculateRoundImpact(player: PlayerGameState, gameState: GameStateSnapshot): number {
    const impactScore = 
      (player.statistics.kills * 2) +
      (player.statistics.assists * 0.5) +
      (player.statistics.utilityDamage / 50) +
      (player.statistics.flashAssists * 0.7);

    // Normalize to 0-1 range
    return Math.min(impactScore / 10, 1);
  }

  /**
   * Check if player is underperforming compared to their usual level
   */
  private isUnderperforming(player: PlayerGameState, memory: BaseMemoryEntry[]): boolean {
    const performanceMemory = memory.find(entry => 
      entry.type === MemoryType.PLAYER_PROFILE
    );

    if (!performanceMemory) {
      return false;
    }

    const profileData = performanceMemory.data as PlayerProfileData;
    const consistency = profileData.playingStyle?.consistency || 0.5;
    return player.statistics.rating < (consistency * 0.7); // 30% below average
  }

  /**
   * Analyze recent team performance
   */
  private analyzeRecentTeamPerformance(
    gameState: GameStateSnapshot,
    memory: BaseMemoryEntry[]
  ): number {
    const recentRounds = memory
      .filter(entry => entry.type === MemoryType.SESSION_DATA)
      .slice(0, 3); // Last 3 rounds

    if (recentRounds.length === 0) {
      return 0;
    }

    const roundWins = recentRounds.filter(round => {
      const data = round.data as SessionData;
      return data.currentGameMode === 'competitive' &&
        data.currentTeamComposition?.includes(gameState.processed.teamState.side);
    }).length;

    return roundWins / recentRounds.length;
  }

  /**
   * Check if current situation is a clutch
   */
  private isClutchSituation(gameState: GameStateSnapshot): boolean {
    const aliveTeammates = gameState.processed.teamState.formation.split(',').length;
    const aliveEnemies = 5 - gameState.processed.teamState.score; // Approximate
    return aliveTeammates === 1 && aliveEnemies > 1;
  }

  /**
   * Check if team is under economic pressure
   */
  private isEconomyStressed(gameState: GameStateSnapshot): boolean {
    const economy = gameState.processed.economyState;
    return (
      economy.roundType === 'eco' ||
      economy.roundType === 'semi_eco' ||
      gameState.processed.teamState.economy.buyCapability === 'force_buy'
    );
  }

  /**
   * Check if current round is critical
   */
  private isCriticalRound(gameState: GameStateSnapshot): boolean {
    const round = gameState.processed.mapState.round;
    const teamScore = gameState.processed.teamState.score;
    const maxRounds = 30; // Standard competitive format

    // Match point scenarios
    if (teamScore === 15 || maxRounds - round <= 2) {
      return true;
    }

    // Reset point scenarios (after 15 rounds)
    if (round === 15) {
      return true;
    }

    // Economic turning points
    if (this.isEconomyStressed(gameState) && round > 3) {
      return true;
    }

    return false;
  }

  /**
   * Calculate emotional state based on all indicators
   */
  private calculateEmotionalState(
    performance: any,
    team: any,
    stress: any,
    recentEmotions: BaseMemoryEntry[]
  ): string {
    // Base emotional state calculation
    let emotionalState = 'neutral';

    // Performance-based emotions
    if (performance.isUnderperforming && performance.recentDeaths > 2) {
      emotionalState = 'frustrated';
    } else if (performance.killDeathRatio > 2 && performance.roundImpact > 0.7) {
      emotionalState = 'confident';
    }

    // Team-based emotional modifiers
    if (!team.isTeamWinning && team.recentTeamPerformance < 0.3) {
      emotionalState = emotionalState === 'frustrated' ? 'tilted' : 'pressured';
    } else if (team.isTeamWinning && team.communicationQuality > 0.7) {
      emotionalState = 'motivated';
    }

    // Stress-based modifiers
    if (Object.values(stress).filter(Boolean).length >= 2) {
      emotionalState = 'stressed';
    }

    // Consider recent emotional history
    if (recentEmotions.length > 0) {
      const lastEmotion = recentEmotions[0].metadata.emotionalIndicators[0];
      if (lastEmotion === emotionalState) {
        // Intensify the emotion if it persists
        emotionalState = this.intensifyEmotion(emotionalState);
      }
    }

    return emotionalState;
  }

  /**
   * Adjust emotional state based on situational context
   */
  private adjustEmotionalStateForContext(
    baseState: string,
    context: string[]
  ): string {
    // Clutch situations intensify emotions
    if (context.includes('clutch')) {
      return this.intensifyEmotion(baseState);
    }

    // Economic pressure can dampen positive emotions
    if (context.includes('economy_pressure') && baseState === 'confident') {
      return 'focused';
    }

    // Time pressure can escalate stress
    if (context.includes('time_pressure') && baseState === 'stressed') {
      return 'anxious';
    }

    return baseState;
  }

  /**
   * Intensify an emotional state
   */
  private intensifyEmotion(emotion: string): string {
    const intensityMap: Record<string, string> = {
      'frustrated': 'tilted',
      'confident': 'dominant',
      'pressured': 'stressed',
      'stressed': 'anxious',
      'motivated': 'energized'
    };

    return intensityMap[emotion] || emotion;
  }

  /**
   * Identify learning opportunities from current state
   */
  private identifyLearningOpportunities(gameState: GameStateSnapshot): string[] {
    const opportunities: Array<{
      type: string;
      priority: 'high' | 'medium' | 'low';
      context: string[];
    }> = [];

    const player = gameState.processed.playerState;
    const team = gameState.processed.teamState;
    const situationalFactors = gameState.processed.situationalFactors;
    const economy = gameState.processed.economyState;

    // Positioning and movement
    if (player.riskFactors.includes('positioning')) {
      opportunities.push({
        type: 'positioning_improvement',
        priority: 'high',
        context: ['safety', 'map_control']
      });
    }

    // Aim and combat
    if (player.statistics.kills === 0 && player.statistics.deaths > 1) {
      opportunities.push({
        type: 'aim_training',
        priority: 'high',
        context: ['mechanical_skill', 'confidence']
      });
    }

    // Economy management
    if (economy.roundType === 'eco' || economy.roundType === 'force_buy') {
      opportunities.push({
        type: 'economy_management',
        priority: 'medium',
        context: ['resource_optimization', 'team_coordination']
      });
    }

    // Utility usage
    if (player.statistics.utilityDamage === 0 && player.equipment.flash > 0) {
      opportunities.push({
        type: 'utility_usage',
        priority: 'medium',
        context: ['map_control', 'team_support']
      });
    }

    // Team play
    if (team.communication.activity < 0.3) {
      opportunities.push({
        type: 'communication_improvement',
        priority: 'high',
        context: ['team_coordination', 'information_sharing']
      });
    }

    // Map awareness
    if (situationalFactors.some(f => f.type === 'flanked' || f.type === 'surprised')) {
      opportunities.push({
        type: 'map_awareness',
        priority: 'high',
        context: ['game_sense', 'information_processing']
      });
    }

    // Clutch situations
    if (this.isClutchSituation(gameState)) {
      opportunities.push({
        type: 'clutch_performance',
        priority: 'medium',
        context: ['decision_making', 'pressure_handling']
      });
    }

    // Post-plant/retake scenarios
    if (gameState.processed.mapState.bombState === 'planted') {
      opportunities.push({
        type: team.side === 'CT' ? 'retake_execution' : 'post_plant_positioning',
        priority: 'high',
        context: ['tactical_play', 'time_management']
      });
    }

    // Trading opportunities
    if (team.formation.split(',').length < 4) {
      opportunities.push({
        type: 'trade_fragging',
        priority: 'medium',
        context: ['team_coordination', 'positioning']
      });
    }

    // Sort by priority and return types
    return opportunities
      .sort((a, b) => {
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return priorityMap[b.priority] - priorityMap[a.priority];
      })
      .map(opp => opp.type);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();

    // Check GSI connection
    const gsiLag = now - this.lastGSIUpdate.getTime();
    const isGSIHealthy = gsiLag < this.config.processing.decisionTimeout;

    // Check active decisions
    const staleDecisions = Array.from(this.activeDecisions.entries())
      .filter(([_, execution]) => now - (execution.metadata?.executionTime || 0) > this.config.processing.decisionTimeout);

    // Clean up stale decisions
    for (const [decisionId, execution] of staleDecisions) {
      await this.handleDecisionError(
        execution as AIDecision,
        new Error('Decision execution timeout')
      );
      this.activeDecisions.delete(decisionId);
    }

    // Update health status
    this.healthStatus = {
      status: isGSIHealthy && staleDecisions.length === 0 ? 'healthy' : 'degraded',
      lastCheck: new Date(),
      metrics: {
        gsiLag,
        activeDecisions: this.activeDecisions.size,
        staleDecisions: staleDecisions.length,
        successRate: this.stats.successfulExecutions / 
          (this.stats.successfulExecutions + this.stats.failedExecutions),
        averageExecutionTime: this.stats.averageExecutionTime,
        errorCount: this.healthStatus.metrics.errorCount || 0
      }
    };

    // Emit health status
    this.emit('health-check', this.healthStatus);

    // Try to recover if in error state
    if (this.processingState === ProcessingState.ERROR && isGSIHealthy) {
      this.setProcessingState(ProcessingState.IDLE);
    }
  }

  /**
   * Force analysis (for testing or manual triggers)
   */
  private async forceAnalysis(): Promise<void> {
    const currentState = this.getCurrentState();
    if (currentState) {
      await this.generateAndExecuteDecisions(currentState);
    }
  }

  /**
   * Update player satisfaction score
   */
  private updatePlayerSatisfaction(rating: number): void {
    const weight = 0.1; // Learning rate for satisfaction
    this.stats.playerSatisfactionScore = 
      this.stats.playerSatisfactionScore * (1 - weight) + rating * weight;
  }

  /**
   * Calculate player's attention level
   */
  private calculateAttentionLevel(gameState: GameStateSnapshot): number {
    const player = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    let attentionScore = 0.5; // Base attention level

    // Recent performance impact
    if (player.statistics.kills > 0 || player.statistics.assists > 0) {
      attentionScore += 0.1; // More engaged after successful actions
    }

    // Critical situations increase attention
    if (this.isClutchSituation(gameState) || this.isCriticalRound(gameState)) {
      attentionScore += 0.2;
    }

    // High-pressure situations
    if (situationalFactors.some(f => f.severity === 'critical')) {
      attentionScore += 0.15;
    }

    // Economic pressure can increase focus
    if (this.isEconomyStressed(gameState)) {
      attentionScore += 0.1;
    }

    // Cap attention level between 0 and 1
    return Math.min(Math.max(attentionScore, 0), 1);
  }

  /**
   * Calculate player's receptiveness to coaching
   */
  private calculateReceptiveness(gameState: GameStateSnapshot, emotionalState: string): number {
    let receptiveness = 0.5; // Base receptiveness

    // Emotional state impact
    const emotionalImpact: Record<string, number> = {
      'neutral': 0,
      'confident': 0.2,
      'motivated': 0.3,
      'focused': 0.2,
      'frustrated': -0.2,
      'tilted': -0.4,
      'stressed': -0.1,
      'anxious': -0.3
    };

    receptiveness += emotionalImpact[emotionalState] || 0;

    // Performance impact
    const player = gameState.processed.playerState;
    const recentPerformance = this.analyzeRecentPerformance(gameState);
    
    if (recentPerformance === 'excellent') {
      receptiveness += 0.2; // More receptive when performing well
    } else if (recentPerformance === 'struggling') {
      receptiveness -= 0.1; // Less receptive when struggling
    }

    // Game phase impact
    const phase = gameState.processed.phase;
    if (phase === 'freezetime' || phase === 'warmup') {
      receptiveness += 0.1; // More receptive during low-pressure phases
    } else if (phase === 'live' && this.isClutchSituation(gameState)) {
      receptiveness -= 0.3; // Less receptive during intense situations
    }

    // Team performance impact
    const team = gameState.processed.teamState;
    if (team.score > gameState.processed.mapState.round / 2) {
      receptiveness += 0.1; // More receptive when team is winning
    }

    // Cap receptiveness between 0 and 1
    return Math.min(Math.max(receptiveness, 0), 1);
  }

  /**
   * Update memory based on execution outcome
   */
  private async updateMemoryFromOutcome(
    decision: AIDecision,
    outcome: ExecutionOutcome,
    gameState: GameStateSnapshot
  ): Promise<void> {
    try {
      // Create coaching insights entry
      const insightEntry: CoachingInsightsMemory = {
        id: uuidv4(),
        type: MemoryType.COACHING_INSIGHTS,
        importance: outcome.success ? MemoryImportance.HIGH : MemoryImportance.CRITICAL,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [
          decision.type,
          outcome.success ? 'successful' : 'unsuccessful',
          ...this.extractContextTags(gameState)
        ],
        metadata: {
          decisionId: decision.id,
          playerResponse: outcome.playerResponse,
          measuredImpact: outcome.measuredImpact,
          emotionalState: this.inferEmotionalState(gameState, []),
          gamePhase: gameState.processed.phase,
          situationalFactors: gameState.processed.situationalFactors
        },
              data: {
        insightId: decision.id,
        playerId: gameState.processed.playerState.steamId,
        insight: decision.rationale,
        category: decision.type,
        confidence: outcome.measuredImpact.performance,
        basedOn: [{
          dataSource: 'gameState',
          dataPoints: ['phase', 'playerState', 'teamState'],
          weight: 1.0
        }, {
          dataSource: 'decision',
          dataPoints: ['type', 'priority', 'context'],
          weight: 0.8
        }],
        recommendations: [],
        validated: true,
        validationSource: 'outcome-inference',
        actualOutcome: outcome.success ? 'positive' : 'negative',
        validationScore: outcome.measuredImpact.performance
      }
      };

      // Store the coaching insight
      await this.memoryService.store(insightEntry);

      // Update player profile with learning patterns
      const playerProfile = await this.memoryService.getPlayerProfile(
        gameState.processed.playerState.steamId
      );

      if (playerProfile) {
        const profileData = playerProfile.data as PlayerProfileData;
        const updates: Partial<PlayerProfileMemory> = {
          data: {
            steamId: gameState.processed.playerState.steamId,
            playerName: gameState.processed.playerState.name,
            strengths: profileData.strengths || [],
            weaknesses: profileData.weaknesses || [],
            commonErrors: [
              ...(profileData.commonErrors || []),
              {
                pattern: decision.type,
                frequency: outcome.success ? 0 : 1,
                context: this.extractContextTags(gameState),
                lastOccurrence: new Date()
              }
            ],
            playingStyle: profileData.playingStyle || {
              aggression: 0.5,
              teamwork: 0.5,
              adaptability: 0.5,
              consistency: 0.5,
              preferredRoles: [],
              preferredWeapons: [],
              preferredMaps: []
            },
            mentalState: profileData.mentalState || {
              tiltResistance: 0.5,
              communicationStyle: 'neutral',
              motivationFactors: [],
              learningPreferences: []
            },
            improvementGoals: profileData.improvementGoals || []
          }
        };

        await this.memoryService.update(playerProfile.id, updates);
      }

      // Update session data with interaction outcome
      const sessionData = await this.memoryService.getCurrentSessionData(
        gameState.processed.playerState.steamId
      );

      if (sessionData) {
        const sessionMemory = sessionData.data as SessionData;
        const updates: Partial<SessionDataMemory> = {
          data: {
            sessionId: sessionMemory.sessionId,
            playerId: gameState.processed.playerState.steamId,
            startTime: sessionMemory.startTime,
            currentMap: gameState.processed.mapState.name,
            currentGameMode: 'competitive',
            currentTeamComposition: [gameState.processed.teamState.side],
            observedBehaviors: [
              ...(sessionMemory.observedBehaviors || []),
              {
                timestamp: new Date(),
                behavior: decision.type,
                context: this.extractContextTags(gameState).join(', '),
                significance: outcome.measuredImpact.performance
              }
            ],
            recentTopics: sessionMemory.recentTopics || [],
            coachingNotes: sessionMemory.coachingNotes || [],
            pendingActions: sessionMemory.pendingActions || []
          }
        };

        await this.memoryService.update(sessionData.id, updates);
      }

      // If the outcome was particularly significant, store it as game knowledge
      if (Math.abs(outcome.measuredImpact.performance) > 0.7) {
        const knowledgeEntry: GameKnowledgeMemory = {
          id: uuidv4(),
          type: MemoryType.GAME_KNOWLEDGE,
          importance: MemoryImportance.HIGH,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [
            decision.type,
            'learned_pattern',
            ...this.extractContextTags(gameState)
          ],
          metadata: {
            source: 'outcome-inference',
            confidence: Math.abs(outcome.measuredImpact.performance),
            validationCount: 1
          },
          data: {
            knowledgeType: outcome.success ? GameKnowledgeType.TACTIC : GameKnowledgeType.STRATEGY,
            title: decision.type,
            description: decision.rationale,
            mapSpecific: [gameState.processed.mapState.name],
            situationSpecific: [gameState.processed.phase],
            teamSide: gameState.processed.teamState.side as 'T' | 'CT',
            keyPoints: this.extractContextTags(gameState),
            commonMistakes: [],
            successIndicators: [],
            sources: [{
              type: 'game_analysis',
              description: 'Derived from gameplay observation',
              confidence: Math.abs(outcome.measuredImpact.performance)
            }],
            timesReferenced: 1,
            lastUsed: new Date(),
            effectiveness: outcome.success ? 1 : 0
          }
        };

        await this.memoryService.store(knowledgeEntry);
      }
    } catch (error) {
      console.error('Error updating memory from outcome:', error);
      this.emit('error', error);
    }
  }

  /**
   * Extract context tags from game state
   */
  private extractContextTags(gameState: GameStateSnapshot): string[] {
    const tags: string[] = [
      gameState.processed.phase,
      gameState.processed.economyState.roundType,
      gameState.processed.teamState.side,
      gameState.processed.mapState.name
    ];

    // Add situational factors
    gameState.processed.situationalFactors.forEach(factor => {
      if (factor.severity === 'high' || factor.severity === 'critical') {
        tags.push(factor.type);
      }
    });

    // Add player state indicators
    const player = gameState.processed.playerState;
    if (player.statistics.kills > 0) tags.push('has_kills');
    if (player.statistics.deaths > 0) tags.push('has_deaths');
    if (player.statistics.utilityDamage > 0) tags.push('used_utility');

    return tags.filter(Boolean);
  }

  private calculateUrgency(gameState: GameStateSnapshot): string {
    const phase = gameState.processed.phase;
    const playerState = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    const isCritical = situationalFactors.some(f => f.severity === 'critical');
    const isInCombat = playerState.health > 0 && playerState.health < 100;

    if (isCritical || isInCombat) {
      return 'critical';
    }

    const isClutch = situationalFactors.some(f => f.type === 'clutch');
    if (isClutch || phase === 'match_point') {
      return 'high';
    }

    if (phase === 'freezetime' || phase === 'buy_time') {
      return 'medium';
    }

    return 'low';
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('[AIOrchestrator] Health check failed:', error);
      }
    }, this.config.processing.decisionTimeout);
  }
}

/**
 * Factory function to create orchestrator instances
 */
export const createAIOrchestrator: any = async (
  integration: SystemIntegration,
  config?: Partial<OrchestratorConfig>
): Promise<IOrchestrator> => {
  const orchestrator = new AIOrchestrator(integration, config);
  await orchestrator.initialize(config);
  return orchestrator;
}; 