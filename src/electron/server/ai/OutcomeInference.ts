/**
 * Outcome Inference Algorithms
 * 
 * This module provides sophisticated algorithms for inferring the success or failure
 * of coaching suggestions based on monitored game state and player behavior.
 */

import {
  GameStateSnapshot,
  CoachingOutput,
  ExecutionOutcome,
  CoachingObjective,
  InterventionPriority
} from './orchestrator/OrchestratorArchitecture.js';

/**
 * Outcome inference configuration
 */
export interface OutcomeInferenceConfig {
  minConfidence: number; // Minimum confidence for outcome inference (0-1)
  minSignificantChange: number; // Minimum change significance to consider (0-1)
  minTimeWindow: number; // Minimum time to monitor before inference (ms)
  maxTimeWindow: number; // Maximum time to monitor before forced inference (ms)
  learningRate: number; // Rate of adaptation to new outcomes (0-1)
}

/**
 * Behavioral change analysis
 */
interface BehavioralChange {
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  confidence: number;
  impact: number; // -1 to 1
  context: string[];
}

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  accuracy: number;
  objectives: number;
  utility: number;
  economy: number;
}

/**
 * Outcome inference result
 */
interface OutcomeInferenceResult {
  success: boolean;
  confidence: number;
  impact: number; // -1 to 1
  behavioralChanges: BehavioralChange[];
  performanceChanges: Partial<PerformanceMetrics>;
  learningPoints: string[];
  followUpNeeded: boolean;
}

/**
 * Main outcome inference engine
 */
export class OutcomeInferenceEngine {
  private config: OutcomeInferenceConfig;
  private behaviorPatterns: Map<string, Array<{
    pattern: RegExp;
    type: BehavioralChange['type'];
    confidence: number;
    impact: number;
  }>>;
  private performanceBaselines: Map<string, PerformanceMetrics>;

  constructor(config?: Partial<OutcomeInferenceConfig>) {
    // Initialize configuration with defaults
    this.config = {
      minConfidence: 0.7,
      minSignificantChange: 0.2,
      minTimeWindow: 10000, // 10 seconds
      maxTimeWindow: 120000, // 2 minutes
      learningRate: 0.1,
      ...config
    };

    this.behaviorPatterns = new Map();
    this.performanceBaselines = new Map();

    this.initializeBehaviorPatterns();
  }

  /**
   * Infer outcome from state changes
   */
  async inferOutcome(
    suggestion: CoachingOutput,
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    monitoringTime: number
  ): Promise<OutcomeInferenceResult | null> {
    // Check if enough time has passed
    if (monitoringTime < this.config.minTimeWindow) {
      return null;
    }

    // Analyze behavioral changes
    const behavioralChanges = this.analyzeBehavioralChanges(
      suggestion,
      stateChanges,
      currentState
    );

    // Analyze performance changes
    const performanceChanges = this.analyzePerformanceChanges(
      startState,
      currentState
    );

    // Calculate overall impact and confidence
    const { impact, confidence } = this.calculateOverallImpact(
      behavioralChanges,
      performanceChanges,
      suggestion
    );

    // Extract learning points
    const learningPoints = this.extractLearningPoints(
      suggestion,
      behavioralChanges,
      performanceChanges,
      impact
    );

    // Determine if follow-up is needed
    const followUpNeeded = this.determineFollowUpNeeded(
      impact,
      confidence,
      suggestion
    );

    // Return null if confidence is too low
    if (confidence < this.config.minConfidence) {
      return null;
    }

    return {
      success: impact > 0,
      confidence,
      impact,
      behavioralChanges,
      performanceChanges,
      learningPoints,
      followUpNeeded
    };
  }

  /**
   * Update behavior patterns based on outcomes
   */
  updateBehaviorPatterns(
    patterns: Array<{
      pattern: string;
      type: BehavioralChange['type'];
      confidence: number;
      impact: number;
    }>
  ): void {
    for (const pattern of patterns) {
      const patternRegex = new RegExp(pattern.pattern, 'i');
      const category = this.categorizeBehaviorPattern(pattern.pattern);
      
      const existingPatterns = this.behaviorPatterns.get(category) || [];
      const existingPattern = existingPatterns.find(p => 
        p.pattern.source === patternRegex.source
      );

      if (existingPattern) {
        // Update existing pattern with learning rate
        existingPattern.confidence = (
          existingPattern.confidence * (1 - this.config.learningRate) +
          pattern.confidence * this.config.learningRate
        );
        existingPattern.impact = (
          existingPattern.impact * (1 - this.config.learningRate) +
          pattern.impact * this.config.learningRate
        );
      } else {
        // Add new pattern
        existingPatterns.push({
          pattern: patternRegex,
          type: pattern.type,
          confidence: pattern.confidence,
          impact: pattern.impact
        });
      }

      this.behaviorPatterns.set(category, existingPatterns);
    }
  }

  /**
   * Update performance baselines
   */
  updatePerformanceBaselines(
    playerId: string,
    metrics: Partial<PerformanceMetrics>
  ): void {
    const baseline = this.performanceBaselines.get(playerId) || {
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      accuracy: 0,
      objectives: 0,
      utility: 0,
      economy: 0
    };

    // Update each metric with learning rate
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        baseline[key as keyof PerformanceMetrics] = (
          baseline[key as keyof PerformanceMetrics] * (1 - this.config.learningRate) +
          value * this.config.learningRate
        );
      }
    }

    this.performanceBaselines.set(playerId, baseline);
  }

  /**
   * Initialize behavior pattern recognition
   */
  private initializeBehaviorPatterns(): void {
    // Movement patterns
    this.behaviorPatterns.set('movement', [
      {
        pattern: /moved to (better|safer) position/i,
        type: 'positive',
        confidence: 0.8,
        impact: 0.6
      },
      {
        pattern: /exposed to enemy fire/i,
        type: 'negative',
        confidence: 0.7,
        impact: -0.5
      }
    ]);

    // Combat patterns
    this.behaviorPatterns.set('combat', [
      {
        pattern: /successful trade/i,
        type: 'positive',
        confidence: 0.9,
        impact: 0.7
      },
      {
        pattern: /died without dealing damage/i,
        type: 'negative',
        confidence: 0.8,
        impact: -0.6
      }
    ]);

    // Economy patterns
    this.behaviorPatterns.set('economy', [
      {
        pattern: /efficient buy/i,
        type: 'positive',
        confidence: 0.7,
        impact: 0.5
      },
      {
        pattern: /overspent/i,
        type: 'negative',
        confidence: 0.6,
        impact: -0.4
      }
    ]);

    // Utility patterns
    this.behaviorPatterns.set('utility', [
      {
        pattern: /effective (flash|smoke|molotov)/i,
        type: 'positive',
        confidence: 0.8,
        impact: 0.6
      },
      {
        pattern: /wasted utility/i,
        type: 'negative',
        confidence: 0.7,
        impact: -0.4
      }
    ]);

    // Team play patterns
    this.behaviorPatterns.set('teamplay', [
      {
        pattern: /good trade support/i,
        type: 'positive',
        confidence: 0.8,
        impact: 0.7
      },
      {
        pattern: /failed to support team/i,
        type: 'negative',
        confidence: 0.7,
        impact: -0.5
      }
    ]);
  }

  /**
   * Analyze behavioral changes
   */
  private analyzeBehavioralChanges(
    suggestion: CoachingOutput,
    stateChanges: Array<{
      type: string;
      description: string;
      significance: number;
    }>,
    currentState: GameStateSnapshot
  ): BehavioralChange[] {
    const changes: BehavioralChange[] = [];

    // Analyze each state change
    for (const change of stateChanges) {
      // Skip insignificant changes
      if (change.significance < this.config.minSignificantChange) {
        continue;
      }

      // Match against behavior patterns
      for (const [category, patterns] of this.behaviorPatterns) {
        for (const pattern of patterns) {
          if (pattern.pattern.test(change.description)) {
            changes.push({
              type: pattern.type,
              description: change.description,
              confidence: pattern.confidence * change.significance,
              impact: pattern.impact * change.significance,
              context: [category, ...this.extractContext(change, currentState)]
            });
          }
        }
      }
    }

    // Add suggestion-specific behavioral analysis
    const suggestionChanges = this.analyzeSuggestionSpecificBehavior(
      suggestion,
      stateChanges,
      currentState
    );
    changes.push(...suggestionChanges);

    return changes;
  }

  /**
   * Analyze performance changes
   */
  private analyzePerformanceChanges(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot
  ): Partial<PerformanceMetrics> {
    const changes: Partial<PerformanceMetrics> = {};
    const player = currentState.processed.playerState;
    const startPlayer = startState.processed.playerState;

    // Calculate basic statistics changes
    changes.kills = player.statistics.kills - startPlayer.statistics.kills;
    changes.deaths = player.statistics.deaths - startPlayer.statistics.deaths;
    changes.assists = player.statistics.assists - startPlayer.statistics.assists;

    // Calculate damage output (if available)
    if ('adr' in player.statistics && 'adr' in startPlayer.statistics) {
      changes.damage = player.statistics.adr - startPlayer.statistics.adr;
    }

    // Calculate accuracy (if available)
    // This would need additional data from GSI or another source

    // Calculate objective contribution
    changes.objectives = this.calculateObjectiveContribution(
      startState,
      currentState
    );

    // Calculate utility effectiveness
    changes.utility = this.calculateUtilityEffectiveness(
      startState,
      currentState
    );

    // Calculate economy management
    changes.economy = this.calculateEconomyEfficiency(
      startState,
      currentState
    );

    return changes;
  }

  /**
   * Calculate overall impact and confidence
   */
  private calculateOverallImpact(
    behavioralChanges: BehavioralChange[],
    performanceChanges: Partial<PerformanceMetrics>,
    suggestion: CoachingOutput
  ): { impact: number; confidence: number } {
    let totalImpact = 0;
    let totalConfidence = 0;
    let weights = 0;

    // Weight behavioral changes
    for (const change of behavioralChanges) {
      const weight = this.getBehaviorWeight(change, suggestion);
      totalImpact += change.impact * weight;
      totalConfidence += change.confidence * weight;
      weights += weight;
    }

    // Weight performance changes
    const perfWeight = this.getPerformanceWeight(suggestion);
    if (perfWeight > 0) {
      const perfImpact = this.calculatePerformanceImpact(performanceChanges);
      totalImpact += perfImpact * perfWeight;
      totalConfidence += 0.8 * perfWeight; // High confidence in objective metrics
      weights += perfWeight;
    }

    // Normalize results
    return {
      impact: weights > 0 ? totalImpact / weights : 0,
      confidence: weights > 0 ? totalConfidence / weights : 0
    };
  }

  /**
   * Extract learning points
   */
  private extractLearningPoints(
    suggestion: CoachingOutput,
    behavioralChanges: BehavioralChange[],
    performanceChanges: Partial<PerformanceMetrics>,
    impact: number
  ): string[] {
    const points: string[] = [];

    // Add points about suggestion effectiveness
    if (impact > 0.5) {
      points.push(
        `Suggestion "${suggestion.title}" was highly effective and should be reinforced`
      );
    } else if (impact < -0.3) {
      points.push(
        `Suggestion "${suggestion.title}" may need revision or better timing`
      );
    }

    // Add points about behavioral changes
    const positiveChanges = behavioralChanges.filter(c => c.type === 'positive');
    const negativeChanges = behavioralChanges.filter(c => c.type === 'negative');

    if (positiveChanges.length > 0) {
      points.push(
        `Positive behavioral changes observed: ${positiveChanges
          .map(c => c.description)
          .join(', ')}`
      );
    }

    if (negativeChanges.length > 0) {
      points.push(
        `Areas for improvement identified: ${negativeChanges
          .map(c => c.description)
          .join(', ')}`
      );
    }

    // Add points about performance changes
    const significantPerformanceChanges = Object.entries(performanceChanges)
      .filter(([_, value]) => Math.abs(value) > 0.2);

    if (significantPerformanceChanges.length > 0) {
      points.push(
        `Notable performance changes: ${significantPerformanceChanges
          .map(([metric, value]) => `${metric} ${value > 0 ? 'improved' : 'decreased'}`)
          .join(', ')}`
      );
    }

    return points;
  }

  /**
   * Determine if follow-up is needed
   */
  private determineFollowUpNeeded(
    impact: number,
    confidence: number,
    suggestion: CoachingOutput
  ): boolean {
    // Always follow up on high-priority suggestions with negative impact
    if (
      suggestion.priority === InterventionPriority.HIGH ||
      suggestion.priority === InterventionPriority.IMMEDIATE
    ) {
      return impact < 0;
    }

    // Follow up on suggestions with very negative impact
    if (impact < -0.5 && confidence > 0.6) {
      return true;
    }

    // Follow up on suggestions with unclear outcome
    if (confidence < 0.4 && Math.abs(impact) > 0.3) {
      return true;
    }

    return false;
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
        changes.push(...this.analyzeTacticalBehavior(
          suggestion,
          stateChanges,
          currentState
        ));
        break;

      case 'strategic_guidance':
        changes.push(...this.analyzeStrategicBehavior(
          suggestion,
          stateChanges,
          currentState
        ));
        break;

      case 'error_correction':
        changes.push(...this.analyzeErrorCorrectionBehavior(
          suggestion,
          stateChanges,
          currentState
        ));
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
   * Calculate objective contribution
   */
  private calculateObjectiveContribution(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot
  ): number {
    let contribution = 0;

    // Score contribution
    const scoreDiff = currentState.processed.teamState.score -
      startState.processed.teamState.score;
    if (scoreDiff > 0) {
      contribution += 0.5;
    }

    // Bomb plant/defuse contribution
    if (
      currentState.processed.mapState.bombState === 'planted' &&
      startState.processed.mapState.bombState === 'none'
    ) {
      contribution += 0.3;
    }
    if (
      currentState.processed.mapState.bombState === 'defused' &&
      startState.processed.mapState.bombState === 'planted'
    ) {
      contribution += 0.4;
    }

    return contribution;
  }

  /**
   * Calculate utility effectiveness
   */
  private calculateUtilityEffectiveness(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot
  ): number {
    const player = currentState.processed.playerState;
    const startPlayer = startState.processed.playerState;

    // Track utility usage
    const utilityUsed = {
      flash: startPlayer.equipment.flash - player.equipment.flash,
      smoke: startPlayer.equipment.smoke - player.equipment.smoke,
      molotov: startPlayer.equipment.molotov - player.equipment.molotov,
      he: startPlayer.equipment.he - player.equipment.he
    };

    // If no utility was used, return 0
    const totalUtilityUsed = Object.values(utilityUsed).reduce((sum, val) => sum + val, 0);
    if (totalUtilityUsed === 0) {
      return 0;
    }

    let effectivenessScore = 0;
    let totalWeight = 0;

    // Flash effectiveness
    if (utilityUsed.flash > 0) {
      const flashAssists = player.statistics.flashAssists - startPlayer.statistics.flashAssists;
      const flashedEnemies = player.statistics.enemiesFlashed - startPlayer.statistics.enemiesFlashed;
      const flashEffectiveness = (flashAssists * 0.7 + flashedEnemies * 0.3) / utilityUsed.flash;
      effectivenessScore += flashEffectiveness * 1.2; // Higher weight for flash assists
      totalWeight += 1.2;
    }

    // Smoke effectiveness (based on map control and positioning)
    if (utilityUsed.smoke > 0) {
      const smokeEffectiveness = this.calculateSmokeEffectiveness(
        startState,
        currentState,
        utilityUsed.smoke
      );
      effectivenessScore += smokeEffectiveness;
      totalWeight += 1;
    }

    // Molotov effectiveness (based on damage and area denial)
    if (utilityUsed.molotov > 0) {
      const molotovDamage = player.statistics.utilityDamage - startPlayer.statistics.utilityDamage;
      const molotovEffectiveness = molotovDamage / (utilityUsed.molotov * 40); // 40 is max potential damage
      effectivenessScore += molotovEffectiveness * 1.1;
      totalWeight += 1.1;
    }

    // HE effectiveness (based on damage)
    if (utilityUsed.he > 0) {
      const heDamage = player.statistics.utilityDamage - startPlayer.statistics.utilityDamage;
      const heEffectiveness = heDamage / (utilityUsed.he * 57); // 57 is max HE damage
      effectivenessScore += heEffectiveness;
      totalWeight += 1;
    }

    // Normalize to -1 to 1 range
    return Math.min(Math.max((effectivenessScore / totalWeight) * 2 - 1, -1), 1);
  }

  /**
   * Calculate smoke effectiveness based on map control and positioning
   */
  private calculateSmokeEffectiveness(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot,
    smokesUsed: number
  ): number {
    const player = currentState.processed.playerState;
    const startPlayer = startState.processed.playerState;

    // Factors that indicate effective smoke usage
    let effectiveFactors = 0;

    // Check if player gained advantageous position
    if (player.riskFactors.length < startPlayer.riskFactors.length) {
      effectiveFactors += 1;
    }

    // Check if team gained map control
    if (
      currentState.processed.teamState.mapControl >
      startState.processed.teamState.mapControl
    ) {
      effectiveFactors += 1;
    }

    // Check if smokes blocked enemy sightlines
    if (player.statistics.enemiesBlocked > startPlayer.statistics.enemiesBlocked) {
      effectiveFactors += 1;
    }

    // Check if smokes enabled objective play (plant/defuse)
    if (
      currentState.processed.mapState.bombState !== startState.processed.mapState.bombState &&
      currentState.processed.mapState.bombState !== 'none'
    ) {
      effectiveFactors += 2; // Higher weight for objective-focused utility
    }

    // Calculate effectiveness score (0-1)
    return effectiveFactors / (smokesUsed * 3); // 3 is max factors per smoke
  }

  /**
   * Calculate economy efficiency
   */
  private calculateEconomyEfficiency(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot
  ): number {
    const startMoney = startState.processed.playerState.money;
    const currentMoney = currentState.processed.playerState.money;
    const moneySpent = Math.max(0, startMoney - currentMoney);

    if (moneySpent === 0) {
      return 0;
    }

    // Calculate return on investment
    const kills = currentState.processed.playerState.statistics.kills -
      startState.processed.playerState.statistics.kills;
    const damage = currentState.processed.playerState.statistics.adr -
      startState.processed.playerState.statistics.adr;

    const effectiveness = (kills * 300 + damage) / moneySpent;
    return Math.min(Math.max(effectiveness - 0.5, -1), 1);
  }

  /**
   * Get behavior weight based on suggestion type
   */
  private getBehaviorWeight(
    change: BehavioralChange,
    suggestion: CoachingOutput
  ): number {
    switch (suggestion.type) {
      case 'tactical_advice':
        return change.context.includes('tactical') ? 1.5 : 1;

      case 'strategic_guidance':
        return change.context.includes('strategic') ? 1.5 : 1;

      case 'error_correction':
        return change.context.includes('error') ? 2 : 1;

      default:
        return 1;
    }
  }

  /**
   * Get performance weight based on suggestion type
   */
  private getPerformanceWeight(suggestion: CoachingOutput): number {
    switch (suggestion.type) {
      case 'tactical_advice':
        return 1.5;

      case 'strategic_guidance':
        return 1.2;

      case 'error_correction':
        return 1;

      default:
        return 1;
    }
  }

  /**
   * Calculate performance impact
   */
  private calculatePerformanceImpact(
    changes: Partial<PerformanceMetrics>
  ): number {
    let totalImpact = 0;
    let weights = 0;

    // Weight and normalize each metric
    if (changes.kills !== undefined) {
      totalImpact += Math.min(Math.max(changes.kills / 2, -1), 1) * 1.5;
      weights += 1.5;
    }

    if (changes.deaths !== undefined) {
      totalImpact += Math.min(Math.max(-changes.deaths / 2, -1), 1) * 1.2;
      weights += 1.2;
    }

    if (changes.damage !== undefined) {
      totalImpact += Math.min(Math.max(changes.damage / 100, -1), 1);
      weights += 1;
    }

    if (changes.objectives !== undefined) {
      totalImpact += changes.objectives * 1.3;
      weights += 1.3;
    }

    if (changes.utility !== undefined) {
      totalImpact += changes.utility;
      weights += 0.8;
    }

    if (changes.economy !== undefined) {
      totalImpact += changes.economy;
      weights += 1;
    }

    return weights > 0 ? totalImpact / weights : 0;
  }

  /**
   * Extract context from state change
   */
  private extractContext(
    change: {
      type: string;
      description: string;
      significance: number;
    },
    currentState: GameStateSnapshot
  ): string[] {
    const context: string[] = [];

    // Add phase context
    context.push(currentState.processed.phase);

    // Add economic context
    context.push(currentState.processed.economyState.roundType);

    // Add situational context
    const situationalFactors = currentState.processed.situationalFactors
      .filter(f => f.severity === 'high' || f.severity === 'critical')
      .map(f => f.type);
    context.push(...situationalFactors);

    return context;
  }

  /**
   * Categorize behavior pattern
   */
  private categorizeBehaviorPattern(pattern: string): string {
    if (pattern.includes('position') || pattern.includes('angle')) {
      return 'movement';
    }
    if (pattern.includes('kill') || pattern.includes('damage')) {
      return 'combat';
    }
    if (pattern.includes('buy') || pattern.includes('money')) {
      return 'economy';
    }
    if (pattern.includes('flash') || pattern.includes('smoke')) {
      return 'utility';
    }
    if (pattern.includes('team') || pattern.includes('support')) {
      return 'teamplay';
    }
    return 'general';
  }
} 