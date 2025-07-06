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
  IOrchestrator,
  IInputHandler,
  IStateManager,
  IDecisionEngine,
  IToolExecutor,
  IOutputFormatter,
  ProcessingState,
  GameStateSnapshot,
  DecisionContext,
  AIDecision,
  ExecutionResult,
  UserFeedback,
  ExecutionOutcome,
  CoachingOutput,
  OrchestratorConfig,
  OrchestratorStats,
  OrchestratorHealth,
  SystemIntegration,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ResourceLimits,
  InterventionPriority
} from './OrchestratorArchitecture.js';
import { GSIInputHandler } from './GSIDataModel.js';
import { DynamicStateManager } from './StateManager.js';
import { GSIDecisionEngine } from './DecisionEngine.js';
import { SystemPromptManager, CoachingPersonality, ContextMode } from './SystemPromptManager.js';
import { ToolManager } from '../ToolManager.js';
import { MemoryService } from '../memory/MemoryService.js';
import { BaseMemoryEntry, MemoryType, ImportanceLevel } from '../interfaces/MemoryService.js';

/**
 * Tool execution implementation
 */
class AIToolExecutor implements IToolExecutor {
  private toolManager: ToolManager;
  private systemPromptManager: SystemPromptManager;
  private activeExecutions: Map<string, any>;

  constructor(toolManager: ToolManager, systemPromptManager: SystemPromptManager) {
    this.toolManager = toolManager;
    this.systemPromptManager = systemPromptManager;
    this.activeExecutions = new Map();
  }

  async executeDecision(decision: AIDecision): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = decision.id;

    try {
      this.activeExecutions.set(executionId, { 
        state: 'running', 
        progress: 0,
        startTime,
        currentStep: null
      });

      // Execute tool chain
      const toolChainResult = await this.executeToolChain(decision.toolChain);
      
      const executionTime = Date.now() - startTime;
      const success = toolChainResult.successRate > 0.7;

      const result: ExecutionResult = {
        decisionId: decision.id,
        success,
        output: this.formatToolChainOutput(decision, toolChainResult),
        toolResults: toolChainResult,
        metadata: {
          totalTime: executionTime,
          toolsUsed: toolChainResult.steps.map(s => s.toolName),
          memoryAccessed: [], // Would be populated by memory interactions
          confidence: decision.confidence
        }
      };

      this.activeExecutions.delete(executionId);
      return result;

    } catch (error) {
      this.activeExecutions.delete(executionId);
      return {
        decisionId: decision.id,
        success: false,
        output: {
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
        toolResults: { steps: [], totalTime: Date.now() - startTime, successRate: 0 },
        metadata: {
          totalTime: Date.now() - startTime,
          toolsUsed: [],
          memoryAccessed: [],
          confidence: 0
        },
        error: {
          code: 'EXECUTION_FAILED',
          message: error.message,
          details: error
        }
      };
    }
  }

  async executeToolChain(steps: any[]): Promise<any> {
    const results = [];
    let successCount = 0;
    const startTime = Date.now();

    for (const step of steps) {
      try {
        const stepStartTime = Date.now();
        const result = await this.toolManager.executeTool(step.toolName, step.input);
        const executionTime = Date.now() - stepStartTime;

        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: true,
          output: result,
          executionTime,
          error: null
        });
        successCount++;
      } catch (error) {
        results.push({
          stepId: step.stepId,
          toolName: step.toolName,
          success: false,
          output: null,
          executionTime: Date.now() - Date.now(),
          error: error.message
        });
      }
    }

    return {
      steps: results,
      totalTime: Date.now() - startTime,
      successRate: successCount / steps.length
    };
  }

  async handleToolFailure(step: any, error: any): Promise<any> {
    // Implement fallback logic
    if (step.fallbackTool) {
      try {
        return await this.toolManager.executeTool(step.fallbackTool, step.input);
      } catch (fallbackError) {
        throw new Error(`Both primary tool ${step.toolName} and fallback ${step.fallbackTool} failed`);
      }
    }
    throw error;
  }

  monitorExecution(decisionId: string): any {
    return this.activeExecutions.get(decisionId) || { 
      state: 'not_found', 
      progress: 0,
      errors: ['Execution not found'] 
    };
  }

  private formatToolChainOutput(decision: AIDecision, toolChainResult: any): CoachingOutput {
    // Generate coaching output based on tool results
    const lastSuccessfulResult = toolChainResult.steps.reverse().find(s => s.success);
    
    return {
      type: 'tactical_advice',
      priority: decision.priority,
      title: decision.rationale.split(' - ')[0],
      message: lastSuccessfulResult?.output?.text || 'Coaching advice generated',
      details: decision.rationale,
      actionItems: [`Follow guidance from ${decision.toolChain[0]?.toolName}`],
      timing: {
        immediate: decision.priority === InterventionPriority.IMMEDIATE,
        when: decision.priority === InterventionPriority.IMMEDIATE ? 'now' : 'next_round'
      },
      personalization: {
        playerId: 'current_player',
        adaptedForStyle: true,
        confidenceLevel: decision.confidence
      },
      supportingData: toolChainResult
    };
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

  constructor(integration: SystemIntegration, config?: Partial<OrchestratorConfig>) {
    super();
    
    // Initialize configuration
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    
    // Initialize core components
    this.toolManager = integration.toolManager;
    this.memoryService = integration.memoryService;
    
    this.inputHandler = new GSIInputHandler();
    this.stateManager = new DynamicStateManager(this.memoryService);
    this.decisionEngine = new GSIDecisionEngine(this.toolManager);
    this.systemPromptManager = new SystemPromptManager(this.memoryService);
    this.toolExecutor = new AIToolExecutor(this.toolManager, this.systemPromptManager);
    this.outputFormatter = new AIOutputFormatter();
    
    // Initialize state
    this.processingState = ProcessingState.IDLE;
    this.activeDecisions = new Map();
    this.isRunning = false;
    this.lastGSIUpdate = new Date();
    
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
      overall: 'healthy',
      components: {
        inputHandler: 'healthy',
        stateManager: 'healthy',
        decisionEngine: 'healthy',
        toolExecutor: 'healthy',
        outputFormatter: 'healthy',
        memoryService: 'healthy'
      },
      issues: [],
      lastCheck: new Date()
    };

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for component coordination
   */
  private setupEventHandlers(): void {
    // Decision engine events
    this.decisionEngine.on('analysis-started', (data) => {
      this.emit('decision-analysis-started', data);
    });

    this.decisionEngine.on('analysis-completed', (data) => {
      this.emit('decision-analysis-completed', data);
    });

    this.decisionEngine.on('analysis-error', (data) => {
      this.emit('error', new Error(`Decision analysis error: ${data.error}`));
    });

    // State manager events
    this.stateManager.on('state-updated', (snapshot) => {
      this.emit('gsi-update', snapshot);
    });

    this.stateManager.on('pattern-detected', (pattern) => {
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
      this.emit('error', new Error(`Initialization failed: ${error.message}`));
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
      this.isRunning = true;
      this.processingState = ProcessingState.IDLE;
      
      this.emit('started');
      this.emit('state-changed', this.processingState);
    } catch (error) {
      this.isRunning = false;
      this.emit('error', new Error(`Start failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.isRunning = false;
      this.processingState = ProcessingState.IDLE;
      
      // Cancel active decisions
      this.activeDecisions.clear();
      
      // Persist state
      await this.stateManager.persistState();
      
      this.emit('stopped');
      this.emit('state-changed', this.processingState);
    } catch (error) {
      this.emit('error', new Error(`Stop failed: ${error.message}`));
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
    if (!this.isRunning) return;

    try {
      this.setProcessingState(ProcessingState.ANALYZING);
      this.stats.totalGSIUpdates++;
      this.lastGSIUpdate = new Date();

      // Process GSI data through input handler
      const gameStateSnapshot = await this.inputHandler.processGSIUpdate(gsiData);
      
      // Validate the game state
      if (!this.inputHandler.validateGameState(gameStateSnapshot)) {
        this.emit('error', new Error('Invalid game state received'));
        return;
      }

      // Update state manager
      await this.stateManager.updateGameState(gameStateSnapshot);

      // Check if we should generate decisions
      if (this.shouldGenerateDecisions(gameStateSnapshot)) {
        await this.generateAndExecuteDecisions(gameStateSnapshot);
      }

      this.setProcessingState(ProcessingState.IDLE);

    } catch (error) {
      this.setProcessingState(ProcessingState.ERROR);
      this.emit('error', new Error(`GSI processing failed: ${error.message}`));
    }
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
      this.emit('error', new Error(`Command execution failed: ${error.message}`));
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
      this.emit('error', new Error(`Feedback processing failed: ${error.message}`));
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
      this.emit('error', new Error(`System prompt generation failed: ${error.message}`));
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
   * Set processing state and emit events
   */
  private setProcessingState(state: ProcessingState): void {
    if (this.processingState !== state) {
      this.processingState = state;
      this.emit('state-changed', state);
    }
  }

  /**
   * Determine if decisions should be generated based on game state
   */
  private shouldGenerateDecisions(gameState: GameStateSnapshot): boolean {
    // Check rate limiting
    const timeSinceLastDecision = Date.now() - (this.stats.totalDecisions > 0 ? Date.now() : 0);
    if (timeSinceLastDecision < this.config.intervention.minTimeBetweenInterventions) {
      return false;
    }

    // Check if we've reached max interventions for this round
    if (this.activeDecisions.size >= this.config.intervention.maxInterventionsPerRound) {
      return false;
    }

    // Check if there are significant changes or critical situations
    const situationalFactors = gameState.processed.situationalFactors;
    const hasCriticalSituation = situationalFactors.some(factor => 
      factor.severity === 'critical' || factor.actionRequired
    );

    return hasCriticalSituation || this.hasSignificantStateChange(gameState);
  }

  /**
   * Check for significant state changes
   */
  private hasSignificantStateChange(gameState: GameStateSnapshot): boolean {
    const previousState = this.stateManager.getStateHistory(1)[0];
    if (!previousState) return true;

    // Check for context changes
    if (gameState.processed.context !== previousState.processed.context) {
      return true;
    }

    // Check for health/position changes
    const currentPlayer = gameState.processed.playerState;
    const previousPlayer = previousState.processed.playerState;
    
    const healthChange = Math.abs(currentPlayer.health - previousPlayer.health) > 20;
    const positionChange = Math.sqrt(
      Math.pow(currentPlayer.position.x - previousPlayer.position.x, 2) +
      Math.pow(currentPlayer.position.y - previousPlayer.position.y, 2)
    ) > 100;

    return healthChange || positionChange;
  }

  /**
   * Generate and execute decisions based on current state
   */
  private async generateAndExecuteDecisions(gameState: GameStateSnapshot): Promise<void> {
    try {
      this.setProcessingState(ProcessingState.EXECUTING_TOOLS);

      // Prepare decision context
      const decisionContext = await this.prepareDecisionContext(gameState);
      
      // Generate decisions
      const startTime = Date.now();
      const decisions = await this.decisionEngine.analyzeContext(decisionContext);
      const decisionTime = Date.now() - startTime;
      
      this.updateDecisionStats(decisionTime);

      // Execute decisions
      for (const decision of decisions) {
        this.activeDecisions.set(decision.id, decision);
        this.emit('decision-made', decision);
        
        // Execute asynchronously
        this.executeDecisionAsync(decision);
      }

    } catch (error) {
      this.emit('error', new Error(`Decision generation failed: ${error.message}`));
    }
  }

  /**
   * Prepare decision context from current state
   */
  private async prepareDecisionContext(gameState: GameStateSnapshot): Promise<DecisionContext> {
    // Get relevant memory entries
    const playerMemory = await this.memoryService.searchMemory(
      `player:${gameState.processed.playerState.steamId}`,
      { limit: 10, types: [MemoryType.PLAYER_PROFILE, MemoryType.INTERACTION_HISTORY] }
    );

    const sessionHistory = await this.memoryService.searchMemory(
      'session:current',
      { limit: 20, types: [MemoryType.SESSION_DATA] }
    );

    // Determine resource limits based on config
    const resourceLimits: ResourceLimits = {
      maxToolCalls: this.config.processing.maxConcurrentDecisions * 3,
      maxProcessingTime: this.config.processing.decisionTimeout,
      maxMemoryQueries: 5,
      allowLLMCalls: this.config.tools.enableLLMCalls,
      allowTTSGeneration: this.config.tools.enableTTSGeneration
    };

    return {
      gameState,
      playerMemory,
      sessionHistory,
      coachingObjectives: this.determineCoachingObjectives(gameState),
      constraints: {
        timeWindow: this.config.processing.decisionTimeout,
        complexity: this.config.processing.defaultComplexity,
        resourceLimits
      },
      userPreferences: {
        feedbackStyle: this.config.output.defaultFeedbackStyle,
        detailLevel: 'detailed',
        interventionFrequency: 'moderate'
      }
    };
  }

  /**
   * Determine coaching objectives based on game state
   */
  private determineCoachingObjectives(gameState: GameStateSnapshot): any[] {
    // Logic to determine what the player needs coaching on
    const objectives = [];
    const player = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;

    if (player.health < 50) {
      objectives.push('tactical_guidance');
    }

    if (situationalFactors.some(f => f.type === 'economic')) {
      objectives.push('economic_strategy');
    }

    return objectives;
  }

  /**
   * Execute decision asynchronously
   */
  private async executeDecisionAsync(decision: AIDecision): Promise<void> {
    try {
      this.emit('execution-started', decision.id);
      
      const result = await this.toolExecutor.executeDecision(decision);
      
      // Update stats
      if (result.success) {
        this.stats.successfulExecutions++;
      } else {
        this.stats.failedExecutions++;
      }

      // Generate output
      this.setProcessingState(ProcessingState.GENERATING_RESPONSE);
      const output = this.outputFormatter.formatCoachingAdvice(result);
      
      this.setProcessingState(ProcessingState.DELIVERING_FEEDBACK);
      this.emit('output-generated', output);
      this.emit('execution-completed', result);

      // Learn from outcome
      const outcome: ExecutionOutcome = {
        decisionId: decision.id,
        success: result.success,
        playerResponse: 'neutral', // Would be determined by monitoring
        measuredImpact: {
          performance: 0,
          engagement: 0.5,
          learning: 0.3
        },
        followUpRequired: false
      };

      this.decisionEngine.learnFromOutcome(decision, outcome);

      // Remove from active decisions
      this.activeDecisions.delete(decision.id);

    } catch (error) {
      this.stats.failedExecutions++;
      this.activeDecisions.delete(decision.id);
      this.emit('error', new Error(`Decision execution failed: ${error.message}`));
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
   * Update decision statistics
   */
  private updateDecisionStats(decisionTime: number): void {
    this.stats.totalDecisions++;
    this.stats.averageDecisionTime = 
      (this.stats.averageDecisionTime * (this.stats.totalDecisions - 1) + decisionTime) / 
      this.stats.totalDecisions;
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
   * Build contextual input for system prompt generation
   */
  private async buildContextualInputForPrompt(gameState: GameStateSnapshot): Promise<any> {
    // Get relevant memory entries
    const playerMemory = await this.memoryService.searchMemory(
      `player:${gameState.processed.playerState.steamId}`,
      { limit: 10, types: [MemoryType.PLAYER_PROFILE, MemoryType.INTERACTION_HISTORY] }
    );

    const sessionHistory = await this.memoryService.searchMemory(
      'session:current',
      { limit: 20, types: [MemoryType.SESSION_DATA] }
    );

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
      .map(entry => entry.content.substring(0, 50))
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
    const recentDeaths = player.statistics.deaths;
    const health = player.health;
    
    // Check for frustration indicators
    if (recentDeaths > 5 && player.statistics.kills < 2) return 'frustrated';
    if (health < 30 && player.riskFactors.includes('pressure')) return 'stressed';
    if (player.statistics.rating > 1.5) return 'confident';
    
    // Check memory for emotional indicators
    const recentEmotionalMemory = memory.filter(entry => 
      entry.metadata?.emotionalIndicators?.length > 0
    );
    
    if (recentEmotionalMemory.length > 0) {
      const lastEmotional = recentEmotionalMemory[0];
      return lastEmotional.metadata.emotionalIndicators[0] || 'neutral';
    }
    
    return 'neutral';
  }

  /**
   * Calculate player attention level
   */
  private calculateAttentionLevel(gameState: GameStateSnapshot): string {
    const situationalFactors = gameState.processed.situationalFactors;
    const criticalSituations = situationalFactors.filter(f => f.severity === 'critical');
    
    if (criticalSituations.length > 2) return 'high_stress';
    if (criticalSituations.length > 0) return 'focused';
    if (gameState.processed.context === GameContext.CRITICAL_SITUATION) return 'focused';
    return 'relaxed';
  }

  /**
   * Calculate player receptiveness to coaching
   */
  private calculateReceptiveness(gameState: GameStateSnapshot, emotionalState: string): number {
    let receptiveness = 0.7; // Base receptiveness
    
    // Adjust based on emotional state
    switch (emotionalState) {
      case 'frustrated': receptiveness -= 0.3; break;
      case 'confident': receptiveness += 0.2; break;
      case 'stressed': receptiveness -= 0.2; break;
      case 'neutral': break; // No change
    }
    
    // Adjust based on performance
    const rating = gameState.processed.playerState.statistics.rating;
    if (rating < 0.5) receptiveness -= 0.1; // Poor performance may reduce receptiveness
    if (rating > 1.5) receptiveness += 0.1; // Good performance may increase receptiveness
    
    // Ensure within bounds
    return Math.max(0.1, Math.min(1.0, receptiveness));
  }

  /**
   * Identify learning opportunities from current state
   */
  private identifyLearningOpportunities(gameState: GameStateSnapshot): string[] {
    const opportunities = [];
    const player = gameState.processed.playerState;
    const situationalFactors = gameState.processed.situationalFactors;
    
    // Check for positioning improvements
    if (player.riskFactors.includes('positioning')) {
      opportunities.push('positioning_improvement');
    }
    
    // Check for economy lessons
    if (gameState.processed.economyState.roundType === 'eco') {
      opportunities.push('economy_management');
    }
    
    // Check for tactical opportunities
    if (situationalFactors.some(f => f.type === 'tactical')) {
      opportunities.push('tactical_decision_making');
    }
    
    return opportunities;
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const issues: string[] = [];
    
    // Check component health
    const components = {
      inputHandler: 'healthy',
      stateManager: 'healthy', 
      decisionEngine: 'healthy',
      toolExecutor: 'healthy',
      outputFormatter: 'healthy',
      memoryService: 'healthy'
    };

    // Check for issues
    if (Date.now() - this.lastGSIUpdate.getTime() > 30000) {
      issues.push('No GSI updates in 30 seconds');
      components.inputHandler = 'degraded';
    }

    if (this.activeDecisions.size > this.config.processing.maxConcurrentDecisions) {
      issues.push('Too many concurrent decisions');
      components.decisionEngine = 'degraded';
    }

    const overall = issues.length === 0 ? 'healthy' : 
                   issues.length < 3 ? 'degraded' : 'critical';

    this.healthStatus = {
      overall,
      components,
      issues,
      lastCheck: new Date()
    };

    this.emit('health-check', this.healthStatus);
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