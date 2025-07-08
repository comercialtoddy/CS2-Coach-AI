/**
 * Central AI Orchestrator Architecture Definition
 * 
 * This file defines the core architecture, interfaces, and components for the AI orchestrator
 * that manages the step-by-step processing flow from GSI input to AI coaching output.
 */

import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import { ToolExecutionResult } from '../interfaces/ITool.js';
import { BaseMemoryEntry as IMemoryEntry, MemoryType, MemoryImportance } from '../interfaces/MemoryService.js';

// ===== Core Architecture Enums =====

/**
 * Processing states for the orchestrator
 */
export enum ProcessingState {
  IDLE = 'idle',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  ERROR = 'error',
  STOPPED = 'stopped'
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
 * Situational factor types
 */
export type SituationalFactorType = 
  | 'tactical'
  | 'psychological'
  | 'economic'
  | 'positional'
  | 'temporal'
  | 'flanked'
  | 'surprised'
  | 'clutch'
  | 'time_pressure'
  | 'economy_pressure';

/**
 * Situational factor severity
 */
export type SituationalFactorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Situational factor
 */
export interface SituationalFactor {
  type: SituationalFactorType;
  severity: SituationalFactorSeverity;
  description: string;
  context?: string[];
}

/**
 * Economy state types
 */
export type RoundType = 'eco' | 'semi_eco' | 'force_buy' | 'full_buy';

/**
 * Economy state information
 */
export interface EconomyState {
  roundType: RoundType;
  teamAdvantage: 'balanced' | 'advantage' | 'disadvantage';
  nextRoundPrediction: {
    T: RoundType;
    CT: RoundType;
  };
}

/**
 * Player game state
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
  equipment: {
    flash: number;
    smoke: number;
    molotov: number;
    he: number;
    defusekit?: boolean;
  };
  statistics: {
    kills: number;
    deaths: number;
    assists: number;
    adr: number;
    rating: number;
    flashAssists: number;
    enemiesFlashed: number;
    utilityDamage: number;
    enemiesBlocked: number;
  };
  observedBehaviors: string[];
  riskFactors: string[];
  opportunities: string[];
}

/**
 * Team game state
 */
export interface TeamGameState {
  side: 'CT' | 'T';
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
  mapControl: number; // 0-1 representing percentage of map controlled
}

/**
 * Map game state
 */
export interface MapGameState {
  name: string;
  round: number;
  phase: string;
  bombState: 'planted' | 'defused' | 'exploded' | 'none';
  controlledAreas: {
    T: string[];
    CT: string[];
    contested: string[];
  };
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
 * AI decision types
 */
export type AIDecisionType = 
  | 'tactical_advice'
  | 'strategic_guidance'
  | 'error_correction'
  | 'performance_feedback'
  | 'utility_suggestion'
  | 'economy_advice';

/**
 * AI decision
 */
export interface AIDecision {
  id: string;
  type: string;
  priority: InterventionPriority;
  confidence: number;
  rationale: string;
  toolChain: ToolChainStep[];
  context: AIDecisionContext;
  metadata: {
    complexity: number;
    executionTime?: number;
    expectedOutcome?: string;
    riskLevel?: 'low' | 'medium' | 'high';
  };
}

/**
 * Execution result
 */
export interface ExecutionResult {
  decisionId: string;
  success: boolean;
  output: CoachingOutput;
  toolResults: ToolChainResult;
  metadata: ExecutionResultMetadata;
  error?: {
    code: string;
    message: string;
    details: any;
  };
}

/**
 * Execution result metadata
 */
export interface ExecutionResultMetadata {
  totalTime: number;
  toolsUsed: string[];
  memoryAccessed: string[];
  confidence: number;
  gameState: GameStateSnapshot;
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

/**
 * AI decision context
 */
export interface AIDecisionContext {
  gameState: GameStateSnapshot;
  systemPrompt: any;
  playerMemory: IMemoryEntry[];
  coachingObjectives: CoachingObjective[];
  timestamp: Date;
  contextualInput: any;
  sessionHistory?: Array<{
    timestamp: Date;
    type: string;
    content: string;
  }>;
  learningPreferences?: {
    style: string;
    level: string;
    frequency: string;
  };
}

/**
 * Coaching style adaptation
 */
export interface CoachingStyleAdaptation {
  ruleId: string;
  timestamp: Date;
  changes: {
    priority?: InterventionPriority;
    confidence?: number;
    toolChain?: string[];
    cooldown?: number;
  };
  reason: string;
  outcome?: ExecutionOutcome;
}

// ===== Processing Pipeline Interfaces =====

/**
 * Input handler for GSI data ingestion
 */
export interface IInputHandler {
  processGSIUpdate(rawData: CSGO): Promise<GameStateSnapshot>;
  validateGameState(snapshot: GameStateSnapshot): boolean;
  detectContextChange(current: GameStateSnapshot, previous?: GameStateSnapshot): GameContext[];
  extractSituationalFactors(rawData: CSGO): SituationalFactor[];
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
  generateDecisions(context: AIDecisionContext): Promise<AIDecision[]>;
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
  impact: number;
  relevance: number;
  learningPoints: string[];
  timestamp: Date;
  playerResponse: 'positive' | 'neutral' | 'ignored' | 'negative';
  measuredImpact: {
    performance: number;
    engagement: number;
    learning: number;
  };
  followUpRequired: boolean;
  metadata: {
    executionTime: number;
    toolsUsed: string[];
    confidence: number;
  };
}

/**
 * Complete execution result
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
  id: string;
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
  status: 'healthy' | 'degraded' | 'error';
  lastCheck: Date;
  lastError?: {
    code: string;
    message: string;
    timestamp: Date;
  };
  metrics: {
    gsiLag: number;
    activeDecisions: number;
    staleDecisions: number;
    successRate: number;
    averageExecutionTime: number;
    errorCount: number;
  };
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

/**
 * Memory entry data
 */
export interface MemoryEntryData {
  performance?: {
    averageRating: number;
    consistency: number;
    strengths: string[];
    weaknesses: string[];
    learningPatterns: Array<{
      decisionType: string;
      success: boolean;
      impact: number;
      context: string[];
      timestamp: Date;
    }>;
  };
  outcome?: 'win' | 'loss' | 'draw';
  team?: 'CT' | 'T';
  emotionalIndicators?: string[];
  learningPoints?: string[];
  interactions?: Array<{
    decisionId: string;
    type: string;
    success: boolean;
    playerResponse: string;
    impact: {
      performance: number;
      engagement: number;
      learning: number;
    };
    timestamp: Date;
  }>;
}

/**
 * Base memory entry
 */
export interface BaseMemoryEntry {
  id: string;
  type: string;
  content?: string;
  data: MemoryEntryData;
  metadata?: {
    emotionalIndicators?: string[];
    isKeyEvent?: boolean;
    importance?: number;
    confidence?: number;
  };
  timestamp: Date;
}

export interface ResourceLimits {
  maxToolCalls: number;
  maxProcessingTime: number;
  maxMemoryQueries: number;
  allowLLMCalls: boolean;
  allowTTSGeneration: boolean;
}

export interface MemoryQueryOptions {
  type?: MemoryType;
  steamId?: string;
  sessionId?: string;
  tags?: string[];
  importance?: MemoryImportance[];
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface SystemPromptManager {
  generatePrompt(contextualInput: any, coachingObjectives: CoachingObjective[], options?: any): Promise<any>;
  generateContextualInput(gameState: GameStateSnapshot): Promise<any>;
}

export interface MemoryService {
  query(options: MemoryQueryOptions): Promise<{ entries: BaseMemoryEntry[] }>;
} 