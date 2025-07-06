/**
 * Central AI Orchestrator Architecture Definition
 * 
 * This file defines the core architecture, interfaces, and components for the AI orchestrator
 * that manages the step-by-step processing flow from GSI input to AI coaching output.
 */

import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import { ToolExecutionResult } from '../interfaces/ITool.js';
import { BaseMemoryEntry, MemoryType } from '../interfaces/MemoryService.js';

// ===== Core Architecture Enums =====

/**
 * Processing states for the orchestrator
 */
export enum ProcessingState {
  IDLE = 'idle',
  ANALYZING = 'analyzing',
  EXECUTING_TOOLS = 'executing_tools',
  GENERATING_RESPONSE = 'generating_response',
  DELIVERING_FEEDBACK = 'delivering_feedback',
  AWAITING_INPUT = 'awaiting_input',
  ERROR = 'error'
}

/**
 * AI coaching objectives that drive decision making
 */
export enum CoachingObjective {
  PERFORMANCE_IMPROVEMENT = 'performance_improvement',
  TACTICAL_GUIDANCE = 'tactical_guidance',
  MENTAL_COACHING = 'mental_coaching',
  TEAM_COORDINATION = 'team_coordination',
  STRATEGIC_ANALYSIS = 'strategic_analysis',
  ERROR_CORRECTION = 'error_correction',
  SKILL_DEVELOPMENT = 'skill_development'
}

/**
 * Context categories for situational awareness
 */
export enum GameContext {
  ROUND_START = 'round_start',
  MID_ROUND = 'mid_round',
  ROUND_END = 'round_end',
  ECONOMY_PHASE = 'economy_phase',
  TACTICAL_TIMEOUT = 'tactical_timeout',
  INTERMISSION = 'intermission',
  MATCH_END = 'match_end',
  CRITICAL_SITUATION = 'critical_situation',
  LEARNING_OPPORTUNITY = 'learning_opportunity'
}

/**
 * Priority levels for AI interventions
 */
export enum InterventionPriority {
  IMMEDIATE = 'immediate',     // Real-time tactical advice
  HIGH = 'high',              // Important strategic guidance
  MEDIUM = 'medium',          // General improvement suggestions
  LOW = 'low',                // Background analysis
  DEFERRED = 'deferred'       // Post-round analysis
}

// ===== Core Data Structures =====

/**
 * Comprehensive game state representation
 */
export interface GameStateSnapshot {
  raw: CSGO;                    // Raw GSI data
  processed: {
    context: GameContext;
    phase: string;
    timeRemaining?: number;
    playerState: PlayerGameState;
    teamState: TeamGameState;
    mapState: MapGameState;
    economyState: EconomyState;
    situationalFactors: SituationalFactor[];
  };
  timestamp: Date;
  sequenceId: string;
}

/**
 * Individual player state
 */
export interface PlayerGameState {
  steamId: string;
  name: string;
  health: number;
  armor: number;
  money: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  weapons: WeaponInfo[];
  statistics: {
    kills: number;
    deaths: number;
    assists: number;
    adr: number;
    rating: number;
  };
  observedBehaviors: string[];
  riskFactors: string[];
  opportunities: string[];
}

/**
 * Team state information
 */
export interface TeamGameState {
  side: 'T' | 'CT';
  score: number;
  economy: {
    totalMoney: number;
    averageMoney: number;
    buyCapability: 'full_buy' | 'force_buy' | 'eco' | 'semi_eco';
  };
  formation: string;
  strategy: string;
  communication: {
    activity: number;
    coordination: number;
  };
}

/**
 * Map-specific state
 */
export interface MapGameState {
  name: string;
  round: number;
  phase: string;
  bombSite?: 'A' | 'B';
  bombState: 'planted' | 'defused' | 'exploded' | 'none';
  controlledAreas: {
    T: string[];
    CT: string[];
    contested: string[];
  };
}

/**
 * Economic state analysis
 */
export interface EconomyState {
  roundType: 'pistol' | 'eco' | 'force' | 'full' | 'mixed';
  teamAdvantage: 'T' | 'CT' | 'balanced';
  nextRoundPrediction: {
    T: 'buy' | 'eco' | 'force';
    CT: 'buy' | 'eco' | 'force';
  };
}

/**
 * Situational factors affecting decision making
 */
export interface SituationalFactor {
  type: 'tactical' | 'psychological' | 'economic' | 'positional' | 'temporal';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  relevance: number; // 0-1
  actionRequired: boolean;
}

/**
 * Weapon information
 */
export interface WeaponInfo {
  name: string;
  type: 'rifle' | 'pistol' | 'sniper' | 'smg' | 'shotgun' | 'grenade';
  ammo?: number;
  inSlot?: number;
}

// ===== Decision Making Framework =====

/**
 * Decision context for AI processing
 */
export interface DecisionContext {
  gameState: GameStateSnapshot;
  playerMemory: BaseMemoryEntry[];
  sessionHistory: BaseMemoryEntry[];
  coachingObjectives: CoachingObjective[];
  constraints: {
    timeWindow: number;        // Available processing time
    complexity: 'simple' | 'moderate' | 'complex';
    resourceLimits: ResourceLimits;
  };
  userPreferences: {
    feedbackStyle: 'direct' | 'supportive' | 'analytical';
    detailLevel: 'brief' | 'detailed' | 'comprehensive';
    interventionFrequency: 'minimal' | 'moderate' | 'active';
  };
}

/**
 * Resource limits for processing
 */
export interface ResourceLimits {
  maxToolCalls: number;
  maxProcessingTime: number;
  maxMemoryQueries: number;
  allowLLMCalls: boolean;
  allowTTSGeneration: boolean;
}

/**
 * AI decision for tool execution
 */
export interface AIDecision {
  id: string;
  priority: InterventionPriority;
  rationale: string;
  confidence: number;        // 0-1
  toolChain: ToolChainStep[];
  expectedOutcome: string;
  fallbackPlan?: ToolChainStep[];
  metadata: {
    processingTime: number;
    complexity: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * Individual step in tool execution chain
 */
export interface ToolChainStep {
  stepId: string;
  toolName: string;
  input: any;
  expectedOutput: string;
  dependencies: string[];    // IDs of prerequisite steps
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
  };
  fallbackTool?: string;
}

// ===== Processing Pipeline Interfaces =====

/**
 * Input handler for GSI data ingestion
 */
export interface IInputHandler {
  processGSIUpdate(rawData: CSGO): Promise<GameStateSnapshot>;
  validateGameState(snapshot: GameStateSnapshot): boolean;
  detectContextChange(current: GameStateSnapshot, previous?: GameStateSnapshot): GameContext[];
  extractSituationalFactors(snapshot: GameStateSnapshot): SituationalFactor[];
}

/**
 * State manager for maintaining context
 */
export interface IStateManager {
  updateGameState(snapshot: GameStateSnapshot): Promise<void>;
  getCurrentState(): GameStateSnapshot | null;
  getStateHistory(count: number): GameStateSnapshot[];
  detectPatterns(): Pattern[];
  persistState(): Promise<void>;
  loadState(): Promise<void>;
}

/**
 * Decision engine for AI logic
 */
export interface IDecisionEngine {
  analyzeContext(context: DecisionContext): Promise<AIDecision[]>;
  prioritizeDecisions(decisions: AIDecision[]): AIDecision[];
  optimizeToolChain(decision: AIDecision): ToolChainStep[];
  adaptToFeedback(feedback: UserFeedback): void;
  learnFromOutcome(decision: AIDecision, outcome: ExecutionOutcome): void;
}

/**
 * Tool executor for AI operations
 */
export interface IToolExecutor {
  executeDecision(decision: AIDecision): Promise<ExecutionResult>;
  executeToolChain(steps: ToolChainStep[]): Promise<ToolChainResult>;
  handleToolFailure(step: ToolChainStep, error: any): Promise<ToolExecutionResult>;
  monitorExecution(decisionId: string): ExecutionStatus;
}

/**
 * Output formatter for results
 */
export interface IOutputFormatter {
  formatCoachingAdvice(result: ExecutionResult): CoachingOutput;
  generateAudioScript(advice: CoachingOutput): AudioScript;
  formatVisualFeedback(advice: CoachingOutput): VisualFeedback;
  personalizeOutput(output: CoachingOutput, playerProfile: any): CoachingOutput;
}

// ===== Execution Results =====

/**
 * Pattern detected in game state
 */
export interface Pattern {
  type: 'behavioral' | 'tactical' | 'economic' | 'positional';
  description: string;
  frequency: number;
  confidence: number;
  implications: string[];
}

/**
 * User feedback on AI decisions
 */
export interface UserFeedback {
  decisionId: string;
  rating: number;          // 1-5
  helpful: boolean;
  timing: 'too_early' | 'perfect' | 'too_late';
  relevance: number;       // 0-1
  comments?: string;
}

/**
 * Execution outcome tracking
 */
export interface ExecutionOutcome {
  decisionId: string;
  success: boolean;
  playerResponse: 'positive' | 'neutral' | 'negative' | 'ignored';
  measuredImpact: {
    performance: number;    // -1 to 1
    engagement: number;     // 0-1
    learning: number;       // 0-1
  };
  followUpRequired: boolean;
}

/**
 * Complete execution result
 */
export interface ExecutionResult {
  decisionId: string;
  success: boolean;
  output: CoachingOutput;
  toolResults: ToolChainResult;
  metadata: {
    totalTime: number;
    toolsUsed: string[];
    memoryAccessed: string[];
    confidence: number;
  };
  error?: {
    code: string;
    message: string;
    details: any;
  };
}

/**
 * Tool chain execution result
 */
export interface ToolChainResult {
  steps: Array<{
    stepId: string;
    toolName: string;
    success: boolean;
    output: any;
    executionTime: number;
    error?: any;
  }>;
  totalTime: number;
  successRate: number;
}

/**
 * Execution status monitoring
 */
export interface ExecutionStatus {
  decisionId: string;
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;        // 0-1
  currentStep?: string;
  estimatedTimeRemaining?: number;
  errors: any[];
}

/**
 * Final coaching output
 */
export interface CoachingOutput {
  type: 'tactical_advice' | 'strategic_guidance' | 'error_correction' | 'encouragement' | 'analysis';
  priority: InterventionPriority;
  title: string;
  message: string;
  details?: string;
  actionItems: string[];
  timing: {
    immediate: boolean;
    when: 'now' | 'next_round' | 'next_break' | 'post_game';
  };
  personalization: {
    playerId: string;
    adaptedForStyle: boolean;
    confidenceLevel: number;
  };
  supportingData?: any;
}

/**
 * Audio script for TTS
 */
export interface AudioScript {
  text: string;
  voice: string;
  speed: number;
  emphasis: {
    start: number;
    end: number;
    level: 'low' | 'medium' | 'high';
  }[];
  metadata: {
    duration: number;
    priority: InterventionPriority;
  };
}

/**
 * Visual feedback elements
 */
export interface VisualFeedback {
  overlay: {
    enabled: boolean;
    position: 'top' | 'center' | 'bottom';
    duration: number;
  };
  indicators: {
    type: 'arrow' | 'highlight' | 'warning' | 'info';
    position: { x: number; y: number };
    color: string;
    text?: string;
  }[];
  hud: {
    showStats: boolean;
    showAdvice: boolean;
    showProgress: boolean;
  };
}

// ===== Orchestrator Configuration =====

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  processing: {
    maxConcurrentDecisions: number;
    decisionTimeout: number;
    memoryQueryTimeout: number;
    defaultComplexity: 'simple' | 'moderate' | 'complex';
  };
  intervention: {
    maxInterventionsPerRound: number;
    minTimeBetweenInterventions: number;
    adaptToPlayerResponse: boolean;
    learnFromFeedback: boolean;
  };
  tools: {
    enableLLMCalls: boolean;
    enableTTSGeneration: boolean;
    enableMemoryUpdates: boolean;
    defaultToolTimeout: number;
  };
  output: {
    defaultVoice: string;
    defaultFeedbackStyle: 'direct' | 'supportive' | 'analytical';
    enableVisualOverlays: boolean;
    personalizeAdvice: boolean;
  };
  debugging: {
    logDecisions: boolean;
    logToolExecution: boolean;
    logStateChanges: boolean;
    enablePerformanceMetrics: boolean;
  };
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  processing: {
    maxConcurrentDecisions: 3,
    decisionTimeout: 5000,
    memoryQueryTimeout: 2000,
    defaultComplexity: 'moderate'
  },
  intervention: {
    maxInterventionsPerRound: 2,
    minTimeBetweenInterventions: 10000, // 10 seconds
    adaptToPlayerResponse: true,
    learnFromFeedback: true
  },
  tools: {
    enableLLMCalls: true,
    enableTTSGeneration: true,
    enableMemoryUpdates: true,
    defaultToolTimeout: 30000
  },
  output: {
    defaultVoice: 'neutral',
    defaultFeedbackStyle: 'supportive',
    enableVisualOverlays: false,
    personalizeAdvice: true
  },
  debugging: {
    logDecisions: true,
    logToolExecution: true,
    logStateChanges: false,
    enablePerformanceMetrics: true
  }
};

// ===== Main Orchestrator Interface =====

/**
 * Main orchestrator interface that coordinates all AI operations
 */
export interface IOrchestrator extends EventEmitter {
  // Lifecycle
  initialize(config?: Partial<OrchestratorConfig>): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;

  // Core Processing
  processGSIUpdate(gsiData: CSGO): Promise<void>;
  handleUserCommand(command: string, data?: any): Promise<void>;
  handleUserFeedback(feedback: UserFeedback): Promise<void>;

  // State Management
  getCurrentState(): GameStateSnapshot | null;
  getProcessingState(): ProcessingState;
  getActiveDecisions(): AIDecision[];

  // Configuration
  updateConfig(updates: Partial<OrchestratorConfig>): void;
  getConfig(): OrchestratorConfig;

  // Monitoring
  getStats(): OrchestratorStats;
  getHealthStatus(): OrchestratorHealth;

  // Events
  on(event: 'state-changed', listener: (state: ProcessingState) => void): this;
  on(event: 'decision-made', listener: (decision: AIDecision) => void): this;
  on(event: 'execution-started', listener: (decisionId: string) => void): this;
  on(event: 'execution-completed', listener: (result: ExecutionResult) => void): this;
  on(event: 'output-generated', listener: (output: CoachingOutput) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * Orchestrator performance statistics
 */
export interface OrchestratorStats {
  totalGSIUpdates: number;
  totalDecisions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDecisionTime: number;
  averageExecutionTime: number;
  memoryHitRate: number;
  toolUsageStats: Record<string, number>;
  playerSatisfactionScore: number;
}

/**
 * Orchestrator health status
 */
export interface OrchestratorHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    inputHandler: 'healthy' | 'degraded' | 'critical';
    stateManager: 'healthy' | 'degraded' | 'critical';
    decisionEngine: 'healthy' | 'degraded' | 'critical';
    toolExecutor: 'healthy' | 'degraded' | 'critical';
    outputFormatter: 'healthy' | 'degraded' | 'critical';
    memoryService: 'healthy' | 'degraded' | 'critical';
  };
  issues: string[];
  lastCheck: Date;
}

// ===== Event Types =====

/**
 * Orchestrator event types for type-safe event handling
 */
export type OrchestratorEvents = {
  'state-changed': [ProcessingState];
  'decision-made': [AIDecision];
  'execution-started': [string];
  'execution-completed': [ExecutionResult];
  'output-generated': [CoachingOutput];
  'error': [Error];
  'gsi-update': [GameStateSnapshot];
  'user-feedback': [UserFeedback];
  'config-updated': [OrchestratorConfig];
  'health-check': [OrchestratorHealth];
};

// ===== Module Integration Interfaces =====

/**
 * Integration point with existing systems
 */
export interface SystemIntegration {
  toolManager: any;         // ToolManager instance
  memoryService: any;       // MemoryService instance  
  socketIO: any;           // Socket.io instance for real-time communication
  gsiInstance: any;        // CSGOGSI instance
  ttsService?: any;        // Optional TTS service
  llmService?: any;        // Optional LLM service
}

/**
 * Factory function type for creating orchestrator instances
 */
export type OrchestratorFactory = (
  integration: SystemIntegration,
  config?: Partial<OrchestratorConfig>
) => Promise<IOrchestrator>; 