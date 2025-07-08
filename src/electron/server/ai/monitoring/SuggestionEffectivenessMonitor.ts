import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import {
  GameStateSnapshot,
  CoachingObjective,
  CoachingOutput,
  ExecutionOutcome,
  GameContext
} from '../orchestrator/OrchestratorArchitecture.js';
import { GSIMonitoringService } from '../GSIMonitoringService.js';
import { FeedbackLoopManager } from '../feedback/FeedbackLoopManager.js';
import { MemoryService } from '../memory/MemoryService.js';
import {
  InteractionType,
  PlayerReaction,
  MemoryType,
  MemoryImportance
} from '../interfaces/MemoryService.js';

/**
 * Effectiveness monitoring events
 */
enum EffectivenessEvent {
  MONITORING_STARTED = 'monitoring-started',
  EFFECTIVENESS_UPDATED = 'effectiveness-updated',
  MONITORING_COMPLETED = 'monitoring-completed',
  FEEDBACK_GENERATED = 'feedback-generated'
}

/**
 * Effectiveness monitoring configuration
 */
interface EffectivenessConfig {
  minMonitoringTime: number; // Minimum time to monitor before generating feedback
  maxMonitoringTime: number; // Maximum time to monitor a suggestion
  significanceThreshold: number; // Minimum change significance to consider
  learningThreshold: number; // Minimum learning score to consider successful
  engagementThreshold: number; // Minimum engagement score to consider successful
}

/**
 * Effectiveness monitoring status
 */
interface MonitoringStatus {
  suggestionId: string;
  startTime: Date;
  lastUpdate: Date;
  effectiveness: {
    learning: number;
    engagement: number;
    impact: number;
  };
  changes: Array<{
    timestamp: Date;
    type: string;
    description: string;
    significance: number;
  }>;
  feedback?: {
    outcome: ExecutionOutcome;
    learningPoints: string[];
    recommendations: string[];
  };
}

/**
 * Main suggestion effectiveness monitor implementation
 */
export class SuggestionEffectivenessMonitor extends EventEmitter {
  private gsiMonitoring: GSIMonitoringService;
  private feedbackLoop: FeedbackLoopManager;
  private memoryService: MemoryService;
  private config: EffectivenessConfig;
  private activeMonitoring: Map<string, MonitoringStatus>;

  constructor(
    gsiMonitoring: GSIMonitoringService,
    feedbackLoop: FeedbackLoopManager,
    memoryService: MemoryService,
    config?: Partial<EffectivenessConfig>
  ) {
    super();
    this.gsiMonitoring = gsiMonitoring;
    this.feedbackLoop = feedbackLoop;
    this.memoryService = memoryService;
    this.activeMonitoring = new Map();

    // Initialize configuration with defaults
    this.config = {
      minMonitoringTime: 10000, // 10 seconds
      maxMonitoringTime: 60000, // 1 minute
      significanceThreshold: 0.3,
      learningThreshold: 0.6,
      engagementThreshold: 0.5,
      ...config
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Start monitoring a suggestion's effectiveness
   */
  async startMonitoring(
    suggestion: CoachingOutput,
    initialState: GameStateSnapshot
  ): Promise<string> {
    // Start GSI monitoring
    const monitoringId = await this.gsiMonitoring.startMonitoring(
      suggestion,
      initialState
    );

    // Initialize monitoring status
    this.activeMonitoring.set(monitoringId, {
      suggestionId: suggestion.id,
      startTime: new Date(),
      lastUpdate: new Date(),
      effectiveness: {
        learning: 0,
        engagement: 0,
        impact: 0
      },
      changes: []
    });

    // Emit monitoring started event
    this.emit(EffectivenessEvent.MONITORING_STARTED, {
      monitoringId,
      suggestion,
      timestamp: new Date()
    });

    return monitoringId;
  }

  /**
   * Get current monitoring status
   */
  getStatus(monitoringId: string): MonitoringStatus | null {
    return this.activeMonitoring.get(monitoringId) || null;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for GSI monitoring events
    this.gsiMonitoring.on('state-change', async (data: any) => {
      await this.handleStateChange(data);
    });

    this.gsiMonitoring.on('significant-change', async (data: any) => {
      await this.handleSignificantChange(data);
    });

    this.gsiMonitoring.on('monitoring-complete', async (data: any) => {
      await this.handleMonitoringComplete(data);
    });
  }

  /**
   * Handle state change event
   */
  private async handleStateChange(data: {
    monitoringId: string;
    suggestion: CoachingOutput;
    checkpoint: {
      timestamp: Date;
      state: GameStateSnapshot;
      changes: Array<{
        type: string;
        description: string;
        significance: number;
      }>;
    };
  }): Promise<void> {
    const monitoring = this.activeMonitoring.get(data.monitoringId);
    if (!monitoring) return;

    // Update last update time
    monitoring.lastUpdate = new Date();

    // Process significant changes
    const significantChanges = data.checkpoint.changes.filter(
      c => c.significance >= this.config.significanceThreshold
    );
    if (significantChanges.length > 0) {
      monitoring.changes.push(
        ...significantChanges.map(c => ({
          timestamp: data.checkpoint.timestamp,
          ...c
        }))
      );
    }

    // Update effectiveness metrics
    monitoring.effectiveness = {
      learning: this.calculateLearningScore(monitoring),
      engagement: this.calculateEngagementScore(monitoring),
      impact: this.calculateImpactScore(monitoring)
    };

    // Emit effectiveness updated event
    this.emit(EffectivenessEvent.EFFECTIVENESS_UPDATED, {
      monitoringId: data.monitoringId,
      effectiveness: monitoring.effectiveness,
      changes: significantChanges
    });

    // Check if we should generate feedback
    await this.checkFeedbackGeneration(data.monitoringId);
  }

  /**
   * Handle significant change event
   */
  private async handleSignificantChange(data: {
    monitoringId: string;
    suggestion: CoachingOutput;
    changes: Array<{
      type: string;
      description: string;
      significance: number;
    }>;
  }): Promise<void> {
    const monitoring = this.activeMonitoring.get(data.monitoringId);
    if (!monitoring) return;

    // Add changes to monitoring
    monitoring.changes.push(
      ...data.changes.map(c => ({
        timestamp: new Date(),
        ...c
      }))
    );

    // Update effectiveness immediately
    monitoring.effectiveness = {
      learning: this.calculateLearningScore(monitoring),
      engagement: this.calculateEngagementScore(monitoring),
      impact: this.calculateImpactScore(monitoring)
    };

    // Check if we should generate feedback
    await this.checkFeedbackGeneration(data.monitoringId);
  }

  /**
   * Handle monitoring complete event
   */
  private async handleMonitoringComplete(data: {
    monitoringId: string;
    suggestion: CoachingOutput;
    checkpoints: Array<{
      timestamp: Date;
      state: GameStateSnapshot;
      changes: Array<{
        type: string;
        description: string;
        significance: number;
      }>;
    }>;
    outcome: ExecutionOutcome;
  }): Promise<void> {
    const monitoring = this.activeMonitoring.get(data.monitoringId);
    if (!monitoring) return;

    // Generate final feedback if not already done
    if (!monitoring.feedback) {
      await this.generateFeedback(data.monitoringId, true);
    }

    // Emit completion event
    this.emit(EffectivenessEvent.MONITORING_COMPLETED, {
      monitoringId: data.monitoringId,
      suggestion: data.suggestion,
      effectiveness: monitoring.effectiveness,
      feedback: monitoring.feedback
    });

    // Clean up
    this.activeMonitoring.delete(data.monitoringId);
  }

  /**
   * Check if feedback should be generated
   */
  private async checkFeedbackGeneration(monitoringId: string): Promise<void> {
    const monitoring = this.activeMonitoring.get(monitoringId);
    if (!monitoring || monitoring.feedback) return;

    const now = Date.now();
    const monitoringTime = now - monitoring.startTime.getTime();

    // Check if minimum monitoring time has passed
    if (monitoringTime < this.config.minMonitoringTime) return;

    // Check if we have significant changes
    if (monitoring.changes.length === 0) return;

    // Check if effectiveness thresholds are met
    const shouldGenerateFeedback =
      monitoring.effectiveness.learning >= this.config.learningThreshold ||
      monitoring.effectiveness.engagement >= this.config.engagementThreshold ||
      monitoringTime >= this.config.maxMonitoringTime;

    if (shouldGenerateFeedback) {
      await this.generateFeedback(monitoringId);
    }
  }

  /**
   * Generate feedback for a monitored suggestion
   */
  private async generateFeedback(
    monitoringId: string,
    isFinal: boolean = false
  ): Promise<void> {
    const monitoring = this.activeMonitoring.get(monitoringId);
    if (!monitoring) return;

    // Get player reaction
    const playerReaction = this.inferPlayerResponse(monitoring);

    // Create outcome
    const outcome: ExecutionOutcome = {
      decisionId: monitoring.suggestionId,
      success: this.isEffective(monitoring.effectiveness),
      impact: monitoring.effectiveness.impact,
      relevance: monitoring.effectiveness.engagement,
      learningPoints: [],
      timestamp: new Date(),
      playerResponse: this.mapPlayerReactionToString(playerReaction),
      measuredImpact: {
        performance: monitoring.effectiveness.impact,
        engagement: monitoring.effectiveness.engagement,
        learning: monitoring.effectiveness.learning
      },
      followUpRequired: false,
      metadata: {
        executionTime: Date.now() - monitoring.startTime.getTime(),
        toolsUsed: [],
        confidence: this.calculateConfidence(monitoring)
      }
    };

    // Generate learning points
    const learningPoints = this.generateLearningPoints(monitoring);

    // Generate recommendations
    const recommendations = this.generateRecommendations(monitoring);

    // Store feedback
    monitoring.feedback = {
      outcome,
      learningPoints,
      recommendations
    };

    // Get current game state from last checkpoint
    const lastCheckpoint = monitoring.changes[monitoring.changes.length - 1];
    const currentState: GameStateSnapshot = {
      raw: {} as CSGO,
      processed: {
        context: GameContext.MID_ROUND,
        phase: 'live',
        playerState: {} as any,
        teamState: {} as any,
        mapState: {} as any,
        economyState: {} as any,
        situationalFactors: []
      },
      timestamp: lastCheckpoint ? lastCheckpoint.timestamp : new Date(),
      sequenceId: monitoringId
    };

    // Process feedback through feedback loop
    await this.feedbackLoop.processFeedback({
      suggestionId: monitoring.suggestionId,
      timestamp: new Date(),
      playerResponse: playerReaction,
      gameState: currentState,
      outcome,
      learningPoints,
      adaptationRecommendations: recommendations
    });

    // Emit feedback generated event
    this.emit(EffectivenessEvent.FEEDBACK_GENERATED, {
      monitoringId,
      feedback: monitoring.feedback,
      isFinal
    });
  }

  /**
   * Calculate learning score
   */
  private calculateLearningScore(monitoring: MonitoringStatus): number {
    if (monitoring.changes.length === 0) return 0;

    // Calculate weighted average of change significance
    const totalSignificance = monitoring.changes.reduce(
      (sum, change) => sum + change.significance,
      0
    );

    // Consider recency of changes
    const now = Date.now();
    const weightedSum = monitoring.changes.reduce((sum, change) => {
      const age = now - change.timestamp.getTime();
      const recencyWeight = Math.exp(-age / 30000); // Exponential decay
      return sum + (change.significance * recencyWeight);
    }, 0);

    return weightedSum / totalSignificance;
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(monitoring: MonitoringStatus): number {
    if (monitoring.changes.length === 0) return 0;

    // Count different types of engagement
    const engagementTypes = new Set(
      monitoring.changes.map(c => c.type)
    );

    // Calculate engagement based on variety and frequency
    const varietyScore = engagementTypes.size / 5; // Normalize by expected types
    const frequencyScore = Math.min(monitoring.changes.length / 10, 1);

    return (varietyScore + frequencyScore) / 2;
  }

  /**
   * Calculate impact score
   */
  private calculateImpactScore(monitoring: MonitoringStatus): number {
    if (monitoring.changes.length === 0) return 0;

    // Calculate impact based on high-significance changes
    const significantChanges = monitoring.changes.filter(
      c => c.significance >= this.config.significanceThreshold
    );

    if (significantChanges.length === 0) return 0;

    // Calculate weighted impact
    return significantChanges.reduce(
      (sum, change) => sum + change.significance,
      0
    ) / significantChanges.length;
  }

  /**
   * Calculate confidence in effectiveness assessment
   */
  private calculateConfidence(monitoring: MonitoringStatus): number {
    // Consider monitoring duration
    const duration = monitoring.lastUpdate.getTime() - monitoring.startTime.getTime();
    const durationConfidence = Math.min(duration / this.config.maxMonitoringTime, 1);

    // Consider number of changes
    const changesConfidence = Math.min(monitoring.changes.length / 10, 1);

    // Consider consistency of changes
    const changeTypes = new Set(monitoring.changes.map(c => c.type));
    const consistencyConfidence = changeTypes.size > 1 ? 0.8 : 0.5;

    return (durationConfidence + changesConfidence + consistencyConfidence) / 3;
  }

  /**
   * Check if effectiveness metrics indicate success
   */
  private isEffective(effectiveness: MonitoringStatus['effectiveness']): boolean {
    return (
      effectiveness.learning >= this.config.learningThreshold ||
      effectiveness.engagement >= this.config.engagementThreshold ||
      effectiveness.impact >= 0.7
    );
  }

  /**
   * Generate learning points from monitoring data
   */
  private generateLearningPoints(monitoring: MonitoringStatus): string[] {
    const points: string[] = [];

    // Add points about engagement
    if (monitoring.effectiveness.engagement >= this.config.engagementThreshold) {
      points.push(
        'Player showed active engagement with the suggestion'
      );
    } else {
      points.push(
        'Player engagement could be improved'
      );
    }

    // Add points about learning
    if (monitoring.effectiveness.learning >= this.config.learningThreshold) {
      points.push(
        'Evidence of successful learning from the suggestion'
      );
    }

    // Add points about specific changes
    const significantChanges = monitoring.changes.filter(
      c => c.significance >= this.config.significanceThreshold
    );
    if (significantChanges.length > 0) {
      points.push(
        `Observed significant changes: ${
          significantChanges
            .map(c => c.description)
            .slice(0, 3)
            .join(', ')
        }`
      );
    }

    return points;
  }

  /**
   * Generate recommendations from monitoring data
   */
  private generateRecommendations(monitoring: MonitoringStatus): string[] {
    const recommendations: string[] = [];

    // Add timing-based recommendations
    const responseTime = monitoring.changes[0]?.timestamp.getTime() -
      monitoring.startTime.getTime();
    if (responseTime && responseTime > 5000) {
      recommendations.push(
        'Consider simplifying suggestions for faster response'
      );
    }

    // Add engagement-based recommendations
    if (monitoring.effectiveness.engagement < this.config.engagementThreshold) {
      recommendations.push(
        'Improve suggestion relevance to increase engagement'
      );
    }

    // Add learning-based recommendations
    if (monitoring.effectiveness.learning < this.config.learningThreshold) {
      recommendations.push(
        'Adjust suggestion complexity for better learning outcomes'
      );
    }

    // Add impact-based recommendations
    if (monitoring.effectiveness.impact < 0.5) {
      recommendations.push(
        'Review suggestion effectiveness in similar situations'
      );
    }

    return recommendations;
  }

  /**
   * Infer player response from monitoring data
   */
  private inferPlayerResponse(monitoring: MonitoringStatus): PlayerReaction {
    const effectiveness = monitoring.effectiveness;
    
    if (effectiveness.engagement > 0.8 && effectiveness.learning > 0.8) {
      return PlayerReaction.POSITIVE;
    }
    
    if (effectiveness.engagement > 0.5 || effectiveness.learning > 0.5) {
      return PlayerReaction.NEUTRAL;
    }
    
    return PlayerReaction.RESISTANT;
  }

  private mapPlayerReactionToString(reaction: PlayerReaction): 'positive' | 'neutral' | 'ignored' | 'negative' {
    switch (reaction) {
      case PlayerReaction.POSITIVE:
        return 'positive';
      case PlayerReaction.NEUTRAL:
        return 'neutral';
      case PlayerReaction.RESISTANT:
        return 'negative';
      case PlayerReaction.CONFUSED:
      case PlayerReaction.DEFENSIVE:
        return 'ignored';
      default:
        return 'neutral';
    }
  }
} 