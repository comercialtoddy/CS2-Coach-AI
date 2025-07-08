import { EventEmitter } from 'events';
import {
  GameStateSnapshot,
  CoachingObjective,
  CoachingOutput,
  ExecutionOutcome,
  InterventionPriority
} from '../orchestrator/OrchestratorArchitecture.js';
import { MemoryService } from '../memory/MemoryService.js';
import {
  InteractionType,
  PlayerReaction,
  MemoryType,
  MemoryImportance,
  BaseMemoryEntry
} from '../interfaces/MemoryService.js';

/**
 * Inference events
 */
enum InferenceEvent {
  OUTCOME_INFERRED = 'outcome-inferred',
  PATTERN_DETECTED = 'pattern-detected',
  CONFIDENCE_UPDATED = 'confidence-updated',
  BEHAVIOR_ANALYZED = 'behavior-analyzed'
}

/**
 * Inference configuration
 */
interface InferenceConfig {
  minConfidenceThreshold: number; // Minimum confidence for outcome inference
  maxInferenceTime: number; // Maximum time to spend on inference (ms)
  patternMatchThreshold: number; // Minimum similarity for pattern matching (0-1)
  contextWindowSize: number; // Number of past states to consider for context
  learningRate: number; // Rate at which to update pattern weights (0-1)
  minTimeWindow: number; // Minimum time to monitor before inference (ms)
  maxTimeWindow: number; // Maximum time to monitor before forced inference (ms)
}

/**
 * Behavioral change type
 */
interface BehavioralChange {
  type: 'positive' | 'negative';
  description: string;
  confidence: number;
  impact: number;
  context: string[];
}

/**
 * Pattern interface
 */
interface Pattern {
  id: string;
  name: string;
  description: string;
  conditions: Array<{
    type: string;
    operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains';
    value: any;
    weight: number;
  }>;
  outcomes: Array<{
    type: string;
    probability: number;
    confidence: number;
  }>;
  metadata: {
    totalMatches: number;
    successfulMatches: number;
    lastUpdated: Date;
    averageConfidence: number;
  };
}

/**
 * Extended execution outcome with type information
 */
interface ExtendedExecutionOutcome extends Omit<ExecutionOutcome, 'metadata'> {
  type: string;
  confidence: number;
  relevance: number;
  learningPoints: string[];
  timestamp: Date;
  metadata: {
    executionTime: number;
    toolsUsed: string[];
    confidence: number;
    patterns?: string[];
    behaviors?: string[];
  };
}

/**
 * Extended coaching output with description
 */
interface ExtendedCoachingOutput extends CoachingOutput {
  description?: string;
}

/**
 * Coaching style adaptation
 */
interface CoachingStyleAdaptation {
  timestamp: Date;
  changes: {
    priority?: InterventionPriority;
    confidence?: number;
    toolChain?: string[];
    cooldown?: number;
  };
  reason: string;
  outcome?: ExtendedExecutionOutcome;
}

/**
 * Adaptive coaching configuration
 */
interface AdaptiveCoachingConfig {
  learningRate: number;
  minConfidence: number;
  maxAdaptations: number;
  adaptationThreshold: number;
  cooldownPeriod: number;
}

/**
 * Main outcome inference engine implementation
 */
export class OutcomeInferenceEngine extends EventEmitter {
  private memoryService: MemoryService;
  private config: InferenceConfig;
  private patterns: Map<string, Pattern>;
  private patternWeights: Map<string, number>;
  private contextHistory: Array<{
    timestamp: Date;
    state: GameStateSnapshot;
    patterns: string[];
  }>;
  private adaptiveConfig: AdaptiveCoachingConfig;
  private adaptationHistory: CoachingStyleAdaptation[];

  constructor(
    memoryService: MemoryService,
    config?: Partial<InferenceConfig>
  ) {
    super();
    this.memoryService = memoryService;
    this.patterns = new Map();
    this.patternWeights = new Map();
    this.contextHistory = [];
    this.adaptationHistory = [];

    // Initialize configuration with defaults
    this.config = {
      minConfidenceThreshold: 0.7,
      maxInferenceTime: 5000,
      patternMatchThreshold: 0.8,
      contextWindowSize: 10,
      learningRate: 0.1,
      minTimeWindow: 10000, // 10 seconds
      maxTimeWindow: 120000, // 2 minutes
      ...config
    };

    // Initialize adaptive coaching config
    this.adaptiveConfig = {
      learningRate: 0.1,
      minConfidence: 0.6,
      maxAdaptations: 10,
      adaptationThreshold: 0.3,
      cooldownPeriod: 300000 // 5 minutes
    };

    // Initialize default patterns
    this.initializePatterns();
  }

  /**
   * Infer outcome from game state changes
   */
  async inferOutcome(
    changes: Array<{
      type: string;
      description: string;
      significance: number;
      timestamp: Date;
    }>,
    context: {
      suggestion: CoachingOutput;
      initialState: GameStateSnapshot;
      currentState: GameStateSnapshot;
    }
  ): Promise<ExecutionOutcome> {
    const startTime = Date.now();
    const monitoringTime = startTime - (context.initialState.timestamp instanceof Date ? 
      context.initialState.timestamp.getTime() : 
      typeof context.initialState.timestamp === 'number' ? 
        context.initialState.timestamp : 
        startTime);

    // Check if enough time has passed
    if (monitoringTime < this.config.minTimeWindow) {
      return this.handleInsufficientData(startTime);
    }

    try {
      // Analyze behavioral changes based on suggestion type
      const behavioralChanges = this.analyzeSuggestionSpecificBehavior(
        context.suggestion,
        changes,
        context.currentState
      );

      // Match patterns against changes
      const matchedPatterns: Array<{
        pattern: Pattern;
        similarity: number;
      }> = [];

      for (const [_, pattern] of this.patterns) {
        const similarity = this.matchPattern(pattern, changes, context);
        if (similarity >= this.config.patternMatchThreshold) {
          matchedPatterns.push({ pattern, similarity });
        }
      }

      // Sort patterns by similarity and weight
      matchedPatterns.sort((a, b) => {
        const weightA = this.patternWeights.get(a.pattern.id) || 1;
        const weightB = this.patternWeights.get(b.pattern.id) || 1;
        return (b.similarity * weightB) - (a.similarity * weightA);
      });

      // Generate outcome from matched patterns and behavioral changes
      const outcome = await this.generateOutcome(matchedPatterns, behavioralChanges, context);

      // Update pattern statistics
      await this.updatePatternStats(matchedPatterns, outcome);

      // Update context history
      this.updateContextHistory(context.currentState, matchedPatterns.map(m => m.pattern.id));

      // Emit events
      this.emit(InferenceEvent.BEHAVIOR_ANALYZED, { behavioralChanges });
      this.emit(InferenceEvent.OUTCOME_INFERRED, {
        outcome,
        matchedPatterns: matchedPatterns.map(m => ({
          id: m.pattern.id,
          name: m.pattern.name,
          similarity: m.similarity
        })),
        inferenceTime: Date.now() - startTime
      });

      return outcome;

    } catch (error) {
      console.error('Error inferring outcome:', error);
      throw error;
    }
  }

  /**
   * Adapt coaching style based on outcomes
   */
  async adaptCoachingStyle(
    suggestion: CoachingOutput,
    gameState: GameStateSnapshot
  ): Promise<CoachingOutput> {
    try {
      // Get recent outcomes for this suggestion type
      const recentOutcomes = await this.getRecentOutcomes(suggestion.type);
      
      // Calculate success metrics
      const metrics = this.calculateSuccessMetrics(recentOutcomes);
      
      // Check if adaptation is needed
      if (!this.needsAdaptation(metrics)) {
        return suggestion;
      }

      // Get player profile and preferences
      const playerProfile = await this.getPlayerProfile(suggestion.personalization.playerId);
      
      // Create adaptation
      const adaptation = await this.createAdaptation(suggestion, metrics, playerProfile, gameState);
      
      // Apply adaptation
      const adaptedSuggestion = this.applyAdaptation(suggestion, adaptation);
      
      // Store adaptation in history
      this.storeAdaptation(adaptation);

      return adaptedSuggestion;
    } catch (error) {
      console.error('Error adapting coaching style:', error);
      return suggestion;
    }
  }

  /**
   * Get pattern statistics
   */
  getPatternStats(): Array<{
    id: string;
    name: string;
    totalMatches: number;
    successRate: number;
    confidence: number;
    lastUpdated: Date;
  }> {
    return Array.from(this.patterns.values()).map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      totalMatches: pattern.metadata.totalMatches,
      successRate: pattern.metadata.successfulMatches / pattern.metadata.totalMatches,
      confidence: pattern.metadata.averageConfidence,
      lastUpdated: pattern.metadata.lastUpdated
    }));
  }

  /**
   * Initialize default patterns
   */
  private initializePatterns(): void {
    // Pattern: Successful Tactical Execution
    this.patterns.set('tactical_success', {
      id: 'tactical_success',
      name: 'Successful Tactical Execution',
      description: 'Player successfully executed suggested tactical maneuver',
      conditions: [
        {
          type: 'position',
          operator: 'contains',
          value: 'optimized',
          weight: 0.7
        },
        {
          type: 'kills',
          operator: 'greaterThan',
          value: 0,
          weight: 0.8
        }
      ],
      outcomes: [
        {
          type: 'tactical_success',
          probability: 0.9,
          confidence: 0.8
        }
      ],
      metadata: {
        totalMatches: 0,
        successfulMatches: 0,
        lastUpdated: new Date(),
        averageConfidence: 0.8
      }
    });

    // Pattern: Improved Positioning
    this.patterns.set('positioning_improvement', {
      id: 'positioning_improvement',
      name: 'Improved Positioning',
      description: 'Player improved their positioning following suggestion',
      conditions: [
        {
          type: 'position',
          operator: 'contains',
          value: 'changed',
          weight: 0.6
        },
        {
          type: 'health',
          operator: 'greaterThan',
          value: 50,
          weight: 0.4
        }
      ],
      outcomes: [
        {
          type: 'positioning_success',
          probability: 0.8,
          confidence: 0.7
        }
      ],
      metadata: {
        totalMatches: 0,
        successfulMatches: 0,
        lastUpdated: new Date(),
        averageConfidence: 0.7
      }
    });

    // Pattern: Economic Management
    this.patterns.set('economy_management', {
      id: 'economy_management',
      name: 'Economic Management',
      description: 'Player followed economic advice',
      conditions: [
        {
          type: 'money',
          operator: 'greaterThan',
          value: 1000,
          weight: 0.6
        },
        {
          type: 'weapons',
          operator: 'contains',
          value: 'bought',
          weight: 0.7
        }
      ],
      outcomes: [
        {
          type: 'economy_success',
          probability: 0.85,
          confidence: 0.75
        }
      ],
      metadata: {
        totalMatches: 0,
        successfulMatches: 0,
        lastUpdated: new Date(),
        averageConfidence: 0.75
      }
    });

    // Initialize pattern weights
    this.patterns.forEach(pattern => {
      this.patternWeights.set(pattern.id, 1);
    });
  }

  /**
   * Match pattern against changes
   */
  private matchPattern(
    pattern: Pattern,
    changes: Array<{
      type: string;
      description: string;
      significance: number;
      timestamp: Date;
    }>,
    context: {
      suggestion: CoachingOutput;
      initialState: GameStateSnapshot;
      currentState: GameStateSnapshot;
    }
  ): number {
    let totalWeight = 0;
    let matchedWeight = 0;

    // Check each condition
    for (const condition of pattern.conditions) {
      totalWeight += condition.weight;

      // Find relevant changes
      const relevantChanges = changes.filter(c => c.type === condition.type);
      if (relevantChanges.length === 0) continue;

      // Check condition against changes
      const matchStrength = this.evaluateCondition(
        condition,
        relevantChanges,
        context
      );

      matchedWeight += condition.weight * matchStrength;
    }

    return totalWeight > 0 ? matchedWeight / totalWeight : 0;
  }

  /**
   * Evaluate condition against changes
   */
  private evaluateCondition(
    condition: Pattern['conditions'][0],
    changes: Array<{
      type: string;
      description: string;
      significance: number;
      timestamp: Date;
    }>,
    context: {
      suggestion: CoachingOutput;
      initialState: GameStateSnapshot;
      currentState: GameStateSnapshot;
    }
  ): number {
    let maxStrength = 0;

    for (const change of changes) {
      let strength = 0;

      switch (condition.operator) {
        case 'equals':
          strength = change.description === condition.value ? 1 : 0;
          break;

        case 'notEquals':
          strength = change.description !== condition.value ? 1 : 0;
          break;

        case 'greaterThan':
          const numValue = parseFloat(change.description.match(/\d+/)?.[0] || '0');
          strength = numValue > condition.value ? 1 : 0;
          break;

        case 'lessThan':
          const numVal = parseFloat(change.description.match(/\d+/)?.[0] || '0');
          strength = numVal < condition.value ? 1 : 0;
          break;

        case 'contains':
          strength = change.description.toLowerCase().includes(condition.value.toLowerCase()) ? 1 : 0;
          break;
      }

      // Weight by change significance
      strength *= change.significance;

      // Update max strength
      maxStrength = Math.max(maxStrength, strength);
    }

    return maxStrength;
  }

  /**
   * Analyze suggestion-specific behavior
   */
  private analyzeSuggestionSpecificBehavior(
    suggestion: CoachingOutput,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    currentState: GameStateSnapshot
  ): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    switch (suggestion.type) {
      case 'tactical_advice':
        changes.push(...this.analyzeTacticalBehavior(suggestion, stateChanges, currentState));
        break;

      case 'strategic_guidance':
        changes.push(...this.analyzeStrategicBehavior(suggestion, stateChanges, currentState));
        break;

      case 'error_correction':
        changes.push(...this.analyzeErrorCorrectionBehavior(suggestion, stateChanges, currentState));
        break;
    }

    return changes;
  }

  /**
   * Analyze tactical behavior changes
   */
  private analyzeTacticalBehavior(
    suggestion: CoachingOutput,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    currentState: GameStateSnapshot
  ): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Analyze positioning
    const positionChanges = stateChanges.filter(c => c.type === 'position');
    if (positionChanges.length > 0) {
      const avgSignificance = positionChanges.reduce(
        (sum, c) => sum + c.significance,
        0
      ) / positionChanges.length;

      changes.push({
        type: avgSignificance > 0.5 ? 'positive' : 'negative',
        description: 'Tactical positioning adjustment',
        confidence: avgSignificance,
        impact: avgSignificance * 2 - 1, // Convert 0-1 to -1 to 1
        context: ['positioning', 'tactical']
      });
    }

    // Analyze combat effectiveness
    const combatChanges = stateChanges.filter(c =>
      c.type === 'kills' ||
      c.type === 'damage' ||
      c.type === 'health'
    );
    if (combatChanges.length > 0) {
      const positiveChanges = combatChanges.filter(c =>
        c.description.includes('kill') ||
        c.description.includes('damage dealt')
      );

      changes.push({
        type: positiveChanges.length > combatChanges.length / 2 ? 'positive' : 'negative',
        description: 'Combat effectiveness',
        confidence: 0.8,
        impact: (positiveChanges.length / combatChanges.length) * 2 - 1,
        context: ['combat', 'tactical']
      });
    }

    return changes;
  }

  /**
   * Analyze strategic behavior changes
   */
  private analyzeStrategicBehavior(
    suggestion: CoachingOutput,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    currentState: GameStateSnapshot
  ): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Analyze economy management
    const economyChanges = stateChanges.filter(c => c.type === 'economy');
    if (economyChanges.length > 0) {
      const positiveChanges = economyChanges.filter(c =>
        c.description.includes('efficient') ||
        c.description.includes('saved') ||
        c.description.includes('good buy')
      );

      changes.push({
        type: positiveChanges.length > economyChanges.length / 2 ? 'positive' : 'negative',
        description: 'Strategic economy management',
        confidence: 0.7,
        impact: (positiveChanges.length / economyChanges.length) * 2 - 1,
        context: ['economy', 'strategic']
      });
    }

    // Analyze team coordination
    const teamChanges = stateChanges.filter(c =>
      c.type === 'strategy' ||
      c.type === 'teamplay'
    );
    if (teamChanges.length > 0) {
      const positiveChanges = teamChanges.filter(c =>
        c.description.includes('coordinated') ||
        c.description.includes('supported') ||
        c.description.includes('team success')
      );

      changes.push({
        type: positiveChanges.length > teamChanges.length / 2 ? 'positive' : 'negative',
        description: 'Strategic team coordination',
        confidence: 0.75,
        impact: (positiveChanges.length / teamChanges.length) * 2 - 1,
        context: ['teamplay', 'strategic']
      });
    }

    return changes;
  }

  /**
   * Analyze error correction behavior
   */
  private analyzeErrorCorrectionBehavior(
    suggestion: CoachingOutput,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    currentState: GameStateSnapshot
  ): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Look for repetition of the error
    const errorRelatedChanges = stateChanges.filter(c =>
      c.description.toLowerCase().includes('error') ||
      c.description.toLowerCase().includes('mistake') ||
      c.description.toLowerCase().includes('failed')
    );

    if (errorRelatedChanges.length > 0) {
      changes.push({
        type: 'negative',
        description: 'Error pattern repeated',
        confidence: 0.9,
        impact: -0.8,
        context: ['error', 'learning']
      });
    } else {
      changes.push({
        type: 'positive',
        description: 'Error successfully avoided',
        confidence: 0.7,
        impact: 0.6,
        context: ['improvement', 'learning']
      });
    }

    return changes;
  }

  /**
   * Update pattern statistics and store in memory
   */
  private async updatePatternStats(
    matchedPatterns: Array<{
      pattern: Pattern;
      similarity: number;
    }>,
    outcome: ExtendedExecutionOutcome
  ): Promise<void> {
    for (const { pattern, similarity } of matchedPatterns) {
      // Update pattern metadata
      pattern.metadata.totalMatches++;
      if (outcome.success) {
        pattern.metadata.successfulMatches++;
      }

      // Update confidence using exponential moving average
      pattern.metadata.averageConfidence = (
        pattern.metadata.averageConfidence * (1 - this.config.learningRate) +
        outcome.confidence * this.config.learningRate
      );

      pattern.metadata.lastUpdated = new Date();

      // Update pattern weight based on success
      const currentWeight = this.patternWeights.get(pattern.id) || 1;
      const successFactor = outcome.success ? 1.1 : 0.9;
      this.patternWeights.set(
        pattern.id,
        Math.max(0.1, Math.min(2, currentWeight * successFactor))
      );

      // Store updated pattern
      this.patterns.set(pattern.id, pattern);

      // Store pattern stats in memory service
      await this.storePatternMemory(pattern, outcome, similarity);

      // Emit pattern update event
      this.emit(InferenceEvent.PATTERN_DETECTED, {
        patternId: pattern.id,
        similarity,
        outcome: {
          success: outcome.success,
          confidence: outcome.confidence
        }
      });
    }
  }

  /**
   * Store pattern memory in memory service
   */
  private async storePatternMemory(
    pattern: Pattern,
    outcome: ExtendedExecutionOutcome,
    similarity: number
  ): Promise<void> {
    try {
      // Create memory entry for pattern update
      const memoryEntry: Omit<BaseMemoryEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        type: MemoryType.COACHING_INSIGHTS,
        importance: MemoryImportance.MEDIUM,
        data: {
          patternId: pattern.id,
          patternName: pattern.name,
          outcomeType: outcome.type,
          success: outcome.success,
          confidence: outcome.confidence,
          impact: outcome.impact,
          similarity,
          metadata: {
            totalMatches: pattern.metadata.totalMatches,
            successfulMatches: pattern.metadata.successfulMatches,
            averageConfidence: pattern.metadata.averageConfidence,
            lastUpdated: pattern.metadata.lastUpdated
          }
        },
        tags: ['pattern_stats', pattern.id, outcome.type],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metadata: {
          source: 'pattern_inference',
          version: '1.0'
        }
      };

      // Store in memory service
      await this.memoryService.store(memoryEntry, {
        forceToLongTerm: true, // Ensure persistence
        mergeStrategy: 'merge' // Update existing if found
      });

    } catch (error) {
      console.error('Error storing pattern memory:', error);
      // Don't throw - we want to continue even if memory storage fails
    }
  }

  /**
   * Store outcome in memory service
   */
  private async storeOutcomeMemory(
    outcome: ExtendedExecutionOutcome,
    context: {
      suggestion: ExtendedCoachingOutput;
      initialState: GameStateSnapshot;
      currentState: GameStateSnapshot;
    },
    matchedPatterns: Array<{
      pattern: Pattern;
      similarity: number;
    }>,
    behavioralChanges: BehavioralChange[]
  ): Promise<void> {
    try {
      // Create memory entry for outcome
      const memoryEntry: Omit<BaseMemoryEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        type: MemoryType.COACHING_INSIGHTS,
        importance: MemoryImportance.HIGH,
        data: {
          outcomeType: outcome.type,
          success: outcome.success,
          confidence: outcome.confidence,
          impact: outcome.impact,
          suggestion: {
            type: context.suggestion.type,
            description: context.suggestion.description || '',
            priority: context.suggestion.priority
          },
          patterns: matchedPatterns.map(({ pattern, similarity }) => ({
            id: pattern.id,
            name: pattern.name,
            similarity
          })),
          behavioralChanges: behavioralChanges.map(change => ({
            type: change.type,
            description: change.description,
            impact: change.impact,
            confidence: change.confidence,
            context: change.context
          })),
          gameState: {
            initial: this.extractRelevantState(context.initialState),
            final: this.extractRelevantState(context.currentState)
          }
        },
        tags: [
          'outcome',
          outcome.type,
          context.suggestion.type,
          ...(outcome.success ? ['success'] : ['failure'])
        ],
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        metadata: {
          source: 'outcome_inference',
          version: '1.0'
        }
      };

      // Store in memory service
      await this.memoryService.store(memoryEntry, {
        forceToLongTerm: true, // Ensure persistence
        mergeStrategy: 'replace' // Each outcome is unique
      });

    } catch (error) {
      console.error('Error storing outcome memory:', error);
      // Don't throw - we want to continue even if memory storage fails
    }
  }

  /**
   * Extract relevant state data for memory storage
   */
  private extractRelevantState(state: GameStateSnapshot): any {
    return {
      player: {
        position: state.processed.playerState.position,
        health: state.processed.playerState.health,
        money: state.processed.playerState.money,
        weapons: state.processed.playerState.weapons,
        statistics: state.processed.playerState.statistics
      },
      team: {
        score: state.processed.teamState.score,
        side: state.processed.teamState.side,
        // Remove mapControl as it doesn't exist in TeamGameState
        // mapControl: state.processed.teamState.mapControl
      },
      map: {
        name: state.processed.mapState.name,
        phase: state.processed.mapState.phase,
        bombState: state.processed.mapState.bombState
      }
    };
  }

  /**
   * Generate outcome from matched patterns and behavioral changes
   */
  private async generateOutcome(
    matchedPatterns: Array<{
      pattern: Pattern;
      similarity: number;
    }>,
    behavioralChanges: BehavioralChange[],
    context: {
      suggestion: ExtendedCoachingOutput;
      initialState: GameStateSnapshot;
      currentState: GameStateSnapshot;
    }
  ): Promise<ExtendedExecutionOutcome> {
    // Calculate overall success and impact
    const positiveChanges = behavioralChanges.filter(c => c.type === 'positive');
    const success = positiveChanges.length > behavioralChanges.length / 2;
    const impact = behavioralChanges.reduce((sum, c) => sum + c.impact, 0) / behavioralChanges.length;
    const confidence = behavioralChanges.reduce((sum, c) => sum + c.confidence, 0) / behavioralChanges.length;

    // Extract patterns and behaviors
    const patterns = matchedPatterns.map(m => m.pattern.id);
    const behaviors = behavioralChanges.map(c => c.type);

    // Create outcome
    return {
      decisionId: context.suggestion.id,
      type: context.suggestion.type,
      success,
      impact,
      confidence,
      relevance: this.calculateReceptiveness(context.currentState),
      learningPoints: behavioralChanges.map(c => c.description),
      timestamp: new Date(),
      playerResponse: positiveChanges.length > 0 ? 'positive' : (behavioralChanges.length > 0 ? 'neutral' : 'ignored'),
      measuredImpact: {
        performance: impact,
        engagement: this.calculateReceptiveness(context.currentState),
        learning: confidence
      },
      followUpRequired: !success || impact < 0,
      metadata: {
        executionTime: Date.now() - context.initialState.timestamp.getTime(),
        toolsUsed: [],
        confidence,
        patterns,
        behaviors
      }
    };
  }

  /**
   * Update context history
   */
  private updateContextHistory(
    state: GameStateSnapshot,
    patterns: string[]
  ): void {
    // Add new context
    this.contextHistory.push({
      timestamp: new Date(),
      state,
      patterns
    });

    // Limit history size
    if (this.contextHistory.length > this.config.contextWindowSize) {
      this.contextHistory.shift();
    }
  }

  /**
   * Get weight for behavioral changes
   */
  private getBehaviorWeight(change: BehavioralChange, suggestion: CoachingOutput): number {
    let weight = 1;

    // Adjust weight based on suggestion type
    if (suggestion.type === 'tactical_advice') {
      if (change.context.includes('tactical')) {
        weight *= 1.2; // Tactical advice has higher weight
      }
    } else if (suggestion.type === 'strategic_guidance') {
      if (change.context.includes('strategic')) {
        weight *= 1.1; // Strategic guidance has higher weight
      }
    } else if (suggestion.type === 'error_correction') {
      if (change.context.includes('error') || change.context.includes('learning')) {
        weight *= 0.9; // Error correction has lower weight
      }
    }

    // Adjust weight based on change type
    if (change.type === 'positive') {
      weight *= 1.1;
    } else if (change.type === 'negative') {
      weight *= 0.9;
    }

    // Adjust weight based on confidence
    weight *= change.confidence;

    return weight;
  }

  /**
   * Get recent outcomes for suggestion type
   */
  private async getRecentOutcomes(
    suggestionType: string
  ): Promise<ExtendedExecutionOutcome[]> {
    try {
      const result = await this.memoryService.query<BaseMemoryEntry>({
        type: MemoryType.COACHING_INSIGHTS,
        tags: ['outcome', suggestionType]
      }, {
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result.entries.map(entry => entry.data as ExtendedExecutionOutcome);
    } catch (error) {
      console.error('Error getting recent outcomes:', error);
      return [];
    }
  }

  /**
   * Calculate success metrics from outcomes
   */
  private calculateSuccessMetrics(outcomes: ExtendedExecutionOutcome[]): {
    successRate: number;
    averageImpact: number;
    averageConfidence: number;
    followRate: number;
  } {
    if (outcomes.length === 0) {
      return {
        successRate: 0.5,
        averageImpact: 0,
        averageConfidence: 0.5,
        followRate: 0.5
      };
    }

    const successCount = outcomes.filter(o => o.success).length;
    const followCount = outcomes.filter(o => o.impact > 0).length;
    
    return {
      successRate: successCount / outcomes.length,
      averageImpact: outcomes.reduce((sum, o) => sum + o.impact, 0) / outcomes.length,
      averageConfidence: outcomes.reduce((sum, o) => sum + o.confidence, 0) / outcomes.length,
      followRate: followCount / outcomes.length
    };
  }

  /**
   * Check if coaching style needs adaptation
   */
  private needsAdaptation(metrics: {
    successRate: number;
    averageImpact: number;
    averageConfidence: number;
    followRate: number;
  }): boolean {
    // Check if we've made too many recent adaptations
    const recentAdaptations = this.adaptationHistory.filter(
      a => Date.now() - a.timestamp.getTime() < this.adaptiveConfig.cooldownPeriod
    ).length;

    if (recentAdaptations >= this.adaptiveConfig.maxAdaptations) {
      return false;
    }

    // Check if performance is below threshold
    return (
      metrics.successRate < this.adaptiveConfig.adaptationThreshold ||
      metrics.followRate < this.adaptiveConfig.adaptationThreshold ||
      metrics.averageImpact < 0
    );
  }

  /**
   * Get player profile from memory
   */
  private async getPlayerProfile(playerId: string): Promise<any> {
    try {
      const result = await this.memoryService.query<BaseMemoryEntry>({
        type: MemoryType.PLAYER_PROFILE,
        steamId: playerId
      }, {
        limit: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return result.entries[0]?.data || null;
    } catch (error) {
      console.error('Error getting player profile:', error);
      return null;
    }
  }

  /**
   * Create coaching style adaptation
   */
  private async createAdaptation(
    suggestion: CoachingOutput,
    metrics: {
      successRate: number;
      averageImpact: number;
      averageConfidence: number;
      followRate: number;
    },
    playerProfile: any,
    gameState: GameStateSnapshot
  ): Promise<CoachingStyleAdaptation> {
    const changes: CoachingStyleAdaptation['changes'] = {};
    const reasons: string[] = [];

    // Adjust priority based on success rate
    if (metrics.successRate < 0.3) {
      changes.priority = this.adjustPriority(suggestion.priority, 'decrease');
      reasons.push('Low success rate');
    } else if (metrics.successRate > 0.7) {
      changes.priority = this.adjustPriority(suggestion.priority, 'increase');
      reasons.push('High success rate');
    }

    // Adjust confidence based on follow rate
    if (metrics.followRate < 0.3) {
      changes.confidence = Math.max(0.1, suggestion.personalization.confidenceLevel * 0.8);
      reasons.push('Low follow rate');
    }

    // Adjust cooldown based on impact
    if (metrics.averageImpact < 0) {
      changes.cooldown = 60000; // 1 minute
      reasons.push('Negative impact');
    }

    // Consider player profile
    if (playerProfile) {
      if (playerProfile.learningStyle === 'analytical') {
        changes.toolChain = ['analyze_position', 'get_stats', 'suggest_improvement'];
        reasons.push('Analytical learning style');
      } else if (playerProfile.learningStyle === 'practical') {
        changes.toolChain = ['demonstrate_technique', 'practice_scenario'];
        reasons.push('Practical learning style');
      }
    }

    // Consider game state
    const receptiveness = this.calculateReceptiveness(gameState);
    if (receptiveness < 0.3) {
      changes.priority = this.adjustPriority(suggestion.priority, 'decrease');
      reasons.push('Low receptiveness');
    }

    return {
      timestamp: new Date(),
      changes,
      reason: reasons.join(', '),
      outcome: undefined // Will be set when outcome is known
    };
  }

  /**
   * Apply adaptation to suggestion
   */
  private applyAdaptation(
    suggestion: CoachingOutput,
    adaptation: CoachingStyleAdaptation
  ): CoachingOutput {
    const adapted = { ...suggestion };

    if (adaptation.changes.priority) {
      adapted.priority = adaptation.changes.priority;
    }

    if (adaptation.changes.confidence) {
      adapted.personalization.confidenceLevel = adaptation.changes.confidence;
    }

    // Update timing based on priority
    adapted.timing.immediate = adapted.priority === InterventionPriority.IMMEDIATE;
    adapted.timing.when = adapted.timing.immediate ? 'now' : 'next_round';

    // Mark as adapted
    adapted.personalization.adaptedForStyle = true;

    return adapted;
  }

  /**
   * Store adaptation in history
   */
  private storeAdaptation(adaptation: CoachingStyleAdaptation): void {
    this.adaptationHistory.push(adaptation);

    // Keep only recent adaptations
    if (this.adaptationHistory.length > this.adaptiveConfig.maxAdaptations) {
      this.adaptationHistory.shift();
    }
  }

  /**
   * Calculate player receptiveness to coaching
   */
  private calculateReceptiveness(gameState: GameStateSnapshot): number {
    let receptiveness = 0.5; // Base receptiveness

    // Game phase impact
    const phase = gameState.processed.phase;
    if (phase === 'freezetime' || phase === 'warmup') {
      receptiveness += 0.1; // More receptive during low-pressure phases
    }

    // Performance impact
    const player = gameState.processed.playerState;
    if (player.statistics.rating > 1.0) {
      receptiveness += 0.2; // More receptive when performing well
    } else if (player.statistics.rating < 0.7) {
      receptiveness -= 0.1; // Less receptive when struggling
    }

    // Team state impact
    const team = gameState.processed.teamState;
    if (team.score > gameState.processed.mapState.round / 2) {
      receptiveness += 0.1; // More receptive when winning
    }

    // Cap between 0 and 1
    return Math.min(Math.max(receptiveness, 0), 1);
  }

  /**
   * Adjust intervention priority
   */
  private adjustPriority(
    current: InterventionPriority,
    direction: 'increase' | 'decrease'
  ): InterventionPriority {
    const priorities = [
      InterventionPriority.LOW,
      InterventionPriority.MEDIUM,
      InterventionPriority.HIGH,
      InterventionPriority.IMMEDIATE
    ];

    const currentIndex = priorities.indexOf(current);
    if (currentIndex === -1) return current;

    if (direction === 'increase') {
      return priorities[Math.min(currentIndex + 1, priorities.length - 1)];
    } else {
      return priorities[Math.max(currentIndex - 1, 0)];
    }
  }

  /**
   * Handle insufficient data case
   */
  private handleInsufficientData(startTime: number): ExtendedExecutionOutcome {
    return {
      decisionId: 'error',
      type: 'insufficient_data',
      success: false,
      impact: 0,
      confidence: 0.1,
      relevance: 0,
      learningPoints: [],
      timestamp: new Date(),
      playerResponse: 'ignored',
      measuredImpact: {
        performance: 0,
        engagement: 0,
        learning: 0
      },
      followUpRequired: true,
      metadata: {
        executionTime: Date.now() - startTime,
        toolsUsed: [],
        confidence: 0.1,
        patterns: [],
        behaviors: []
      }
    };
  }
} 