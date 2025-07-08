/**
 * GSI Monitoring Service
 * 
 * This module provides real-time monitoring of Game State Integration (GSI) data
 * to track the effectiveness of AI coaching suggestions and player responses.
 */

import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import {
  GameStateSnapshot,
  CoachingObjective,
  CoachingOutput,
  ExecutionOutcome
} from './orchestrator/OrchestratorArchitecture.js';
import { GSIInputHandler } from './orchestrator/GSIDataModel.js';
import { AutoCorrectionEngine } from './AutoCorrectionEngine.js';

/**
 * Monitoring configuration
 */
interface MonitoringConfig {
  minSignificantChange: number; // Minimum change significance to record (0-1)
  maxMonitoringTime: number; // Maximum time to monitor a suggestion (ms)
  checkpointInterval: number; // Time between state checkpoints (ms)
  minCheckpoints: number; // Minimum checkpoints before outcome inference
}

/**
 * Monitoring events
 */
enum MonitoringEvent {
  STATE_CHANGE = 'state-change',
  SIGNIFICANT_CHANGE = 'significant-change',
  OUTCOME_DETECTED = 'outcome-detected',
  MONITORING_COMPLETE = 'monitoring-complete'
}

/**
 * GSI monitoring service implementation
 */
export class GSIMonitoringService extends EventEmitter {
  private gsiHandler: GSIInputHandler;
  private autoCorrectionEngine: AutoCorrectionEngine;
  private config: MonitoringConfig;
  private monitoredSuggestions: Map<string, {
    suggestion: CoachingOutput;
    startState: GameStateSnapshot;
    lastCheckpoint: Date;
    checkpoints: Array<{
      timestamp: Date;
      state: GameStateSnapshot;
      changes: Array<{
        type: string;
        description: string;
        significance: number;
      }>;
    }>;
  }>;

  constructor(
    gsiHandler: GSIInputHandler,
    autoCorrectionEngine: AutoCorrectionEngine,
    config?: Partial<MonitoringConfig>
  ) {
    super();
    this.gsiHandler = gsiHandler;
    this.autoCorrectionEngine = autoCorrectionEngine;
    this.monitoredSuggestions = new Map();

    // Initialize configuration with defaults
    this.config = {
      minSignificantChange: 0.2,
      maxMonitoringTime: 60000, // 1 minute
      checkpointInterval: 5000, // 5 seconds
      minCheckpoints: 3,
      ...config
    };
  }

  /**
   * Start monitoring a new suggestion
   */
  async startMonitoring(
    suggestion: CoachingOutput,
    initialState: GameStateSnapshot
  ): Promise<string> {
    // Generate unique ID for monitoring
    const monitoringId = `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize monitoring state
    this.monitoredSuggestions.set(monitoringId, {
      suggestion,
      startState: initialState,
      lastCheckpoint: new Date(),
      checkpoints: []
    });

    // Start tracking with auto-correction engine
    await this.autoCorrectionEngine.trackSuggestion(suggestion, {
      gameState: initialState,
      objectives: this.inferObjectives(suggestion)
    });

    return monitoringId;
  }

  /**
   * Process GSI update for monitoring
   */
  async processGSIUpdate(gsiData: CSGO): Promise<void> {
    // Process GSI data
    const currentState = await this.gsiHandler.processGSIUpdate(gsiData);
    const now = new Date();

    // Check each monitored suggestion
    for (const [id, monitoring] of this.monitoredSuggestions) {
      try {
        // Check if monitoring period is over
        const monitoringTime = now.getTime() - monitoring.startState.timestamp.getTime();
        if (monitoringTime > this.config.maxMonitoringTime) {
          await this.completeMonitoring(id, currentState);
          continue;
        }

        // Check if it's time for a new checkpoint
        const timeSinceLastCheckpoint = now.getTime() - monitoring.lastCheckpoint.getTime();
        if (timeSinceLastCheckpoint >= this.config.checkpointInterval) {
          await this.createCheckpoint(id, currentState);
        }

        // Analyze state changes
        const changes = this.analyzeStateChanges(monitoring.startState, currentState);

        // Record significant changes
        const significantChanges = changes.filter(
          c => c.significance >= this.config.minSignificantChange
        );
        if (significantChanges.length > 0) {
          monitoring.checkpoints.push({
            timestamp: now,
            state: currentState,
            changes: significantChanges
          });

          // Emit significant change event
          this.emit(MonitoringEvent.SIGNIFICANT_CHANGE, {
            monitoringId: id,
            suggestion: monitoring.suggestion,
            changes: significantChanges
          });
        }

        // Check for outcomes
        if (monitoring.checkpoints.length >= this.config.minCheckpoints) {
          const outcome = await this.inferOutcome(monitoring, currentState);
          if (outcome) {
            await this.completeMonitoring(id, currentState);
          }
        }
      } catch (error) {
        console.error(`Error monitoring suggestion ${id}:`, error);
      }
    }
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(id: string): {
    suggestion: CoachingOutput;
    elapsedTime: number;
    checkpoints: number;
    significantChanges: number;
  } | null {
    const monitoring = this.monitoredSuggestions.get(id);
    if (!monitoring) return null;

    const now = Date.now();
    const elapsedTime = now - monitoring.startState.timestamp.getTime();
    const significantChanges = monitoring.checkpoints.reduce(
      (total, cp) => total + cp.changes.length,
      0
    );

    return {
      suggestion: monitoring.suggestion,
      elapsedTime,
      checkpoints: monitoring.checkpoints.length,
      significantChanges
    };
  }

  /**
   * Create a new state checkpoint
   */
  private async createCheckpoint(
    monitoringId: string,
    currentState: GameStateSnapshot
  ): Promise<void> {
    const monitoring = this.monitoredSuggestions.get(monitoringId);
    if (!monitoring) return;

    // Update last checkpoint time
    monitoring.lastCheckpoint = new Date();

    // Analyze changes since last checkpoint
    const changes = this.analyzeStateChanges(
      monitoring.checkpoints[monitoring.checkpoints.length - 1]?.state || monitoring.startState,
      currentState
    );

    // Record checkpoint
    monitoring.checkpoints.push({
      timestamp: new Date(),
      state: currentState,
      changes
    });

    // Emit state change event
    this.emit(MonitoringEvent.STATE_CHANGE, {
      monitoringId,
      suggestion: monitoring.suggestion,
      checkpoint: monitoring.checkpoints[monitoring.checkpoints.length - 1]
    });
  }

  /**
   * Complete monitoring for a suggestion
   */
  private async completeMonitoring(
    monitoringId: string,
    finalState: GameStateSnapshot
  ): Promise<void> {
    const monitoring = this.monitoredSuggestions.get(monitoringId);
    if (!monitoring) return;

    // Create final checkpoint
    await this.createCheckpoint(monitoringId, finalState);

    // Infer final outcome
    const outcome = await this.inferOutcome(monitoring, finalState);

    // Emit completion event
    this.emit(MonitoringEvent.MONITORING_COMPLETE, {
      monitoringId,
      suggestion: monitoring.suggestion,
      checkpoints: monitoring.checkpoints,
      outcome
    });

    // Remove from monitoring
    this.monitoredSuggestions.delete(monitoringId);
  }

  /**
   * Analyze state changes between snapshots
   */
  private analyzeStateChanges(
    startState: GameStateSnapshot,
    currentState: GameStateSnapshot
  ): Array<{
    type: string;
    description: string;
    significance: number;
  }> {
    const changes: Array<{
      type: string;
      description: string;
      significance: number;
    }> = [];

    // Check player state changes
    const playerChanges = this.analyzePlayerStateChanges(
      startState.processed.playerState,
      currentState.processed.playerState
    );
    changes.push(...playerChanges);

    // Check team state changes
    const teamChanges = this.analyzeTeamStateChanges(
      startState.processed.teamState,
      currentState.processed.teamState
    );
    changes.push(...teamChanges);

    // Check map state changes
    const mapChanges = this.analyzeMapStateChanges(
      startState.processed.mapState,
      currentState.processed.mapState
    );
    changes.push(...mapChanges);

    // Check economy state changes
    const economyChanges = this.analyzeEconomyStateChanges(
      startState.processed.economyState,
      currentState.processed.economyState
    );
    changes.push(...economyChanges);

    return changes;
  }

  /**
   * Analyze player state changes
   */
  private analyzePlayerStateChanges(
    startState: GameStateSnapshot['processed']['playerState'],
    currentState: GameStateSnapshot['processed']['playerState']
  ): Array<{
    type: string;
    description: string;
    significance: number;
  }> {
    const changes: Array<{
      type: string;
      description: string;
      significance: number;
    }> = [];

    // Check health changes
    const healthDiff = currentState.health - startState.health;
    if (Math.abs(healthDiff) > 10) {
      changes.push({
        type: 'health',
        description: `Health changed by ${healthDiff}`,
        significance: Math.min(Math.abs(healthDiff) / 100, 1)
      });
    }

    // Check position changes
    const distance = Math.sqrt(
      Math.pow(currentState.position.x - startState.position.x, 2) +
      Math.pow(currentState.position.y - startState.position.y, 2)
    );
    if (distance > 100) {
      changes.push({
        type: 'position',
        description: 'Position changed significantly',
        significance: Math.min(distance / 1000, 1)
      });
    }

    // Check weapon changes
    const weaponChanges = currentState.weapons
      .filter(w => !startState.weapons.some(sw => sw.name === w.name));
    if (weaponChanges.length > 0) {
      changes.push({
        type: 'weapons',
        description: `Weapons changed: ${weaponChanges.map(w => w.name).join(', ')}`,
        significance: 0.5
      });
    }

    // Check statistics changes
    const killDiff = currentState.statistics.kills - startState.statistics.kills;
    if (killDiff > 0) {
      changes.push({
        type: 'kills',
        description: `Got ${killDiff} kill(s)`,
        significance: 0.8
      });
    }

    return changes;
  }

  /**
   * Analyze team state changes
   */
  private analyzeTeamStateChanges(
    startState: GameStateSnapshot['processed']['teamState'],
    currentState: GameStateSnapshot['processed']['teamState']
  ): Array<{
    type: string;
    description: string;
    significance: number;
  }> {
    const changes: Array<{
      type: string;
      description: string;
      significance: number;
    }> = [];

    // Check score changes
    const scoreDiff = currentState.score - startState.score;
    if (scoreDiff !== 0) {
      changes.push({
        type: 'score',
        description: `Score changed by ${scoreDiff}`,
        significance: 1
      });
    }

    // Check economy changes
    if (currentState.economy.buyCapability !== startState.economy.buyCapability) {
      changes.push({
        type: 'economy',
        description: `Economy changed to ${currentState.economy.buyCapability}`,
        significance: 0.7
      });
    }

    // Check strategy changes
    if (currentState.strategy !== startState.strategy) {
      changes.push({
        type: 'strategy',
        description: `Strategy changed to ${currentState.strategy}`,
        significance: 0.6
      });
    }

    return changes;
  }

  /**
   * Analyze map state changes
   */
  private analyzeMapStateChanges(
    startState: GameStateSnapshot['processed']['mapState'],
    currentState: GameStateSnapshot['processed']['mapState']
  ): Array<{
    type: string;
    description: string;
    significance: number;
  }> {
    const changes: Array<{
      type: string;
      description: string;
      significance: number;
    }> = [];

    // Check phase changes
    if (currentState.phase !== startState.phase) {
      changes.push({
        type: 'phase',
        description: `Phase changed to ${currentState.phase}`,
        significance: 0.8
      });
    }

    // Check bomb state changes
    if (currentState.bombState !== startState.bombState) {
      changes.push({
        type: 'bomb',
        description: `Bomb state changed to ${currentState.bombState}`,
        significance: 0.9
      });
    }

    return changes;
  }

  /**
   * Analyze economy state changes
   */
  private analyzeEconomyStateChanges(
    startState: GameStateSnapshot['processed']['economyState'],
    currentState: GameStateSnapshot['processed']['economyState']
  ): Array<{
    type: string;
    description: string;
    significance: number;
  }> {
    const changes: Array<{
      type: string;
      description: string;
      significance: number;
    }> = [];

    // Check round type changes
    if (currentState.roundType !== startState.roundType) {
      changes.push({
        type: 'round_type',
        description: `Round type changed to ${currentState.roundType}`,
        significance: 0.7
      });
    }

    // Check team advantage changes
    if (currentState.teamAdvantage !== startState.teamAdvantage) {
      changes.push({
        type: 'team_advantage',
        description: `Team advantage changed to ${currentState.teamAdvantage}`,
        significance: 0.6
      });
    }

    return changes;
  }

  /**
   * Infer coaching objectives from suggestion
   */
  private inferObjectives(suggestion: CoachingOutput): CoachingObjective[] {
    const objectives: CoachingObjective[] = [];

    switch (suggestion.type) {
      case 'tactical_advice':
        objectives.push(CoachingObjective.TACTICAL_GUIDANCE);
        break;
      case 'strategic_guidance':
        objectives.push(CoachingObjective.STRATEGIC_ANALYSIS);
        break;
      case 'error_correction':
        objectives.push(CoachingObjective.ERROR_CORRECTION);
        break;
      case 'encouragement':
        objectives.push(CoachingObjective.MENTAL_COACHING);
        break;
      case 'analysis':
        objectives.push(CoachingObjective.PERFORMANCE_IMPROVEMENT);
        break;
    }

    return objectives;
  }

  /**
   * Infer outcome from monitoring data
   */
  private async inferOutcome(
    monitoring: NonNullable<ReturnType<typeof this.monitoredSuggestions.get>>,
    currentState: GameStateSnapshot
  ): Promise<ExecutionOutcome | null> {
    if (monitoring.checkpoints.length < this.config.minCheckpoints) {
      return null;
    }

    // Analyze changes for suggestion adherence
    const changes = monitoring.checkpoints.flatMap(cp => cp.changes);
    const significantChanges = changes.filter(
      c => c.significance >= this.config.minSignificantChange
    );

    // Determine success and impact
    let success = false;
    let impact = 0;

    switch (monitoring.suggestion.type) {
      case 'tactical_advice':
        // Success if player survived and/or got kills
        success = currentState.processed.playerState.health > 0 ||
          currentState.processed.playerState.statistics.kills >
          monitoring.startState.processed.playerState.statistics.kills;
        impact = success ? 0.8 : -0.2;
        break;

      case 'strategic_guidance':
        // Success if round won
        const scoreDiff = currentState.processed.teamState.score -
          monitoring.startState.processed.teamState.score;
        success = scoreDiff > 0;
        impact = success ? 1 : -0.3;
        break;

      case 'error_correction':
        // Success if error not repeated
        success = !changes.some(c =>
          c.description.toLowerCase().includes('error') ||
          c.description.toLowerCase().includes('mistake')
        );
        impact = success ? 0.6 : -0.4;
        break;

      default:
        // Generic success criteria
        success = significantChanges.length > 0 &&
          significantChanges.some(c => c.significance > 0.7);
        impact = success ? 0.5 : -0.2;
    }

    return {
      decisionId: monitoring.suggestion.id,
      success,
      impact,
      relevance: this.calculateEngagement(changes),
      learningPoints: significantChanges.map(c => c.description),
      timestamp: new Date(),
      playerResponse: this.inferPlayerResponse(changes),
      measuredImpact: {
        performance: impact,
        engagement: this.calculateEngagement(changes),
        learning: this.calculateLearning(changes)
      },
      followUpRequired: !success || impact < 0,
      metadata: {
        executionTime: Date.now() - monitoring.startState.timestamp.getTime(),
        toolsUsed: [],
        confidence: significantChanges.length > 0 ? 0.8 : 0.5
      }
    };
  }

  /**
   * Infer player response from changes
   */
  private inferPlayerResponse(
    changes: Array<{ type: string; description: string; significance: number }>
  ): 'positive' | 'neutral' | 'ignored' {
    const significantChanges = changes.filter(c => c.significance > 0.5);
    
    if (significantChanges.length === 0) {
      return 'ignored';
    }

    const positiveChanges = significantChanges.filter(c =>
      c.type === 'kills' ||
      c.type === 'score' ||
      (c.type === 'health' && c.description.includes('increased'))
    );

    if (positiveChanges.length > significantChanges.length / 2) {
      return 'positive';
    }

    return 'neutral';
  }

  /**
   * Calculate engagement score from changes
   */
  private calculateEngagement(
    changes: Array<{ type: string; description: string; significance: number }>
  ): number {
    if (changes.length === 0) return 0;

    // Calculate average significance of changes
    const avgSignificance = changes.reduce(
      (sum, c) => sum + c.significance,
      0
    ) / changes.length;

    // Weight by number of changes
    const changeWeight = Math.min(changes.length / 5, 1);

    return avgSignificance * changeWeight;
  }

  /**
   * Calculate learning score from changes
   */
  private calculateLearning(
    changes: Array<{ type: string; description: string; significance: number }>
  ): number {
    if (changes.length === 0) return 0;

    // Look for positive behavioral changes
    const learningIndicators = changes.filter(c =>
      c.type === 'position' || // Better positioning
      c.type === 'strategy' || // Strategy adaptation
      c.type === 'economy' // Better economy management
    );

    if (learningIndicators.length === 0) return 0;

    // Calculate average significance of learning indicators
    const avgSignificance = learningIndicators.reduce(
      (sum, c) => sum + c.significance,
      0
    ) / learningIndicators.length;

    // Weight by consistency of changes
    const consistencyWeight = learningIndicators.length / changes.length;

    return avgSignificance * consistencyWeight;
  }
} 