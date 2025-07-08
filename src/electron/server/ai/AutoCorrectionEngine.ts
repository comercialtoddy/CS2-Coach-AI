/**
 * Auto-Correction Engine
 * 
 * This module implements the feedback loop mechanism that enables the AI agent
 * to monitor the effectiveness of its suggestions and adapt its coaching approach
 * over time based on player responses and outcomes.
 */

import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import {
  GameContext,
  PlayerGameState,
  TeamGameState,
  MapGameState,
  GameStateSnapshot,
  CoachingObjective,
  InterventionPriority,
  CoachingOutput,
  ExecutionOutcome,
  EconomyState
} from './orchestrator/OrchestratorArchitecture.js';
import { MemoryService } from './memory/MemoryService.js';
import {
  InteractionType,
  PlayerReaction,
  InteractionHistoryData,
  MemoryType,
  MemoryImportance
} from './interfaces/MemoryService.js';

/**
 * Suggestion tracking data
 */
interface SuggestionTracker {
  id: string;
  timestamp: Date;
  suggestion: CoachingOutput;
  context: {
    gameState: GameStateSnapshot;
    objectives: CoachingObjective[];
  };
  monitoring: {
    startState: {
      health: number;
      position: { x: number; y: number; z: number };
      weapons: string[];
      money: number;
      score: number;
    };
    timeWindow: number; // Time window to monitor for effects (ms)
    monitorUntil: Date;
    checkpoints: Array<{
      timestamp: Date;
      state: GameStateSnapshot;
      changes: string[];
      significance: number; // 0-1
    }>;
  };
  outcome?: {
    followed: boolean;
    success: boolean;
    impact: number; // -1 to 1
    learningPoints: string[];
  };
}

/**
 * Feedback loop configuration
 */
interface FeedbackLoopConfig {
  monitoringWindow: number; // Default time to monitor suggestion effects (ms)
  significanceThreshold: number; // Minimum change significance to record (0-1)
  adaptationRate: number; // How quickly to adapt to feedback (0-1)
  minSamplesForAdaptation: number; // Minimum samples before adapting approach
  maxTrackedSuggestions: number; // Maximum number of suggestions to track
}

/**
 * Auto-correction engine events
 */
enum AutoCorrectionEvent {
  SUGGESTION_TRACKED = 'suggestion-tracked',
  OUTCOME_DETECTED = 'outcome-detected',
  APPROACH_ADAPTED = 'approach-adapted',
  LEARNING_UPDATED = 'learning-updated'
}

/**
 * Main auto-correction engine implementation
 */
export class AutoCorrectionEngine extends EventEmitter {
  private memoryService: MemoryService;
  private activeSuggestions: Map<string, SuggestionTracker>;
  private config: FeedbackLoopConfig;
  private adaptationStats: Map<string, {
    totalSuggestions: number;
    successfulSuggestions: number;
    followedSuggestions: number;
    averageImpact: number;
    lastAdapted: Date;
  }>;

  constructor(
    memoryService: MemoryService,
    config?: Partial<FeedbackLoopConfig>
  ) {
    super();
    this.memoryService = memoryService;
    this.activeSuggestions = new Map();
    this.adaptationStats = new Map();

    // Initialize configuration with defaults
    this.config = {
      monitoringWindow: 30000, // 30 seconds
      significanceThreshold: 0.2,
      adaptationRate: 0.1,
      minSamplesForAdaptation: 5,
      maxTrackedSuggestions: 100,
      ...config
    };
  }

  /**
   * Track a new suggestion for monitoring
   */
  async trackSuggestion(
    suggestion: CoachingOutput,
    context: {
      gameState: GameStateSnapshot;
      objectives: CoachingObjective[];
    }
  ): Promise<string> {
    // Generate unique ID for the suggestion
    const id = `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create suggestion tracker
    const tracker: SuggestionTracker = {
      id,
      timestamp: new Date(),
      suggestion,
      context,
      monitoring: {
        startState: this.capturePlayerState(context.gameState),
        timeWindow: this.determineMonitoringWindow(suggestion),
        monitorUntil: new Date(Date.now() + this.config.monitoringWindow),
        checkpoints: []
      }
    };

    // Store in active suggestions
    this.activeSuggestions.set(id, tracker);

    // Prune old suggestions if needed
    if (this.activeSuggestions.size > this.config.maxTrackedSuggestions) {
      this.pruneOldSuggestions();
    }

    // Emit tracking event
    this.emit(AutoCorrectionEvent.SUGGESTION_TRACKED, {
      id,
      suggestion,
      timestamp: tracker.timestamp
    });

    return id;
  }

  /**
   * Process GSI update for suggestion monitoring
   */
  async processGSIUpdate(gsiData: CSGO): Promise<void> {
    const gameState = await this.parseGameState(gsiData);
    const now = new Date();

    // Check each active suggestion
    for (const [id, tracker] of this.activeSuggestions) {
      // Skip if monitoring period is over
      if (now > tracker.monitoring.monitorUntil) {
        await this.finalizeSuggestion(id);
        continue;
      }

      // Analyze state changes
      const changes = this.detectStateChanges(
        tracker.monitoring.startState,
        gameState
      );

      // Record significant changes
      if (changes.some(c => c.significance >= this.config.significanceThreshold)) {
        tracker.monitoring.checkpoints.push({
          timestamp: now,
          state: gameState,
          changes: changes.map(c => c.description),
          significance: Math.max(...changes.map(c => c.significance))
        });
      }

      // Check for immediate outcomes
      const outcome = await this.inferOutcome(tracker, gameState);
      if (outcome) {
        tracker.outcome = outcome;
        await this.finalizeSuggestion(id);
      }
    }
  }

  /**
   * Get suggestion monitoring status
   */
  getSuggestionStatus(id: string): {
    suggestion: CoachingOutput;
    monitoring: {
      elapsed: number;
      remaining: number;
      checkpoints: number;
      significance: number;
    };
    outcome?: SuggestionTracker['outcome'];
  } | null {
    const tracker = this.activeSuggestions.get(id);
    if (!tracker) return null;

    const now = Date.now();
    const elapsed = now - tracker.timestamp.getTime();
    const remaining = Math.max(0, tracker.monitoring.monitorUntil.getTime() - now);

    return {
      suggestion: tracker.suggestion,
      monitoring: {
        elapsed,
        remaining,
        checkpoints: tracker.monitoring.checkpoints.length,
        significance: tracker.monitoring.checkpoints.reduce(
          (max, cp) => Math.max(max, cp.significance),
          0
        )
      },
      outcome: tracker.outcome
    };
  }

  /**
   * Get adaptation statistics
   */
  getAdaptationStats(): Array<{
    category: string;
    totalSuggestions: number;
    successRate: number;
    followRate: number;
    averageImpact: number;
    lastAdapted: Date;
  }> {
    return Array.from(this.adaptationStats.entries()).map(([category, stats]) => ({
      category,
      totalSuggestions: stats.totalSuggestions,
      successRate: stats.successfulSuggestions / stats.totalSuggestions,
      followRate: stats.followedSuggestions / stats.totalSuggestions,
      averageImpact: stats.averageImpact,
      lastAdapted: stats.lastAdapted
    }));
  }

  /**
   * Determine monitoring window based on suggestion type
   */
  private determineMonitoringWindow(suggestion: CoachingOutput): number {
    // Use longer window for strategic suggestions
    if (
      suggestion.type === 'strategic_guidance' ||
      suggestion.priority === InterventionPriority.LOW
    ) {
      return this.config.monitoringWindow * 2;
    }

    // Use shorter window for immediate tactical suggestions
    if (
      suggestion.type === 'tactical_advice' &&
      suggestion.priority === InterventionPriority.IMMEDIATE
    ) {
      return this.config.monitoringWindow / 2;
    }

    return this.config.monitoringWindow;
  }

  /**
   * Capture relevant player state for monitoring
   */
  private capturePlayerState(gameState: GameStateSnapshot): SuggestionTracker['monitoring']['startState'] {
    const player = gameState.processed.playerState;
    return {
      health: player.health,
      position: { ...player.position },
      weapons: player.weapons.map(w => w.name),
      money: player.money,
      score: gameState.processed.teamState.score
    };
  }

  /**
   * Detect significant state changes
   */
  private detectStateChanges(
    startState: SuggestionTracker['monitoring']['startState'],
    currentState: GameStateSnapshot
  ): Array<{ description: string; significance: number }> {
    const changes: Array<{ description: string; significance: number }> = [];
    const player = currentState.processed.playerState;

    // Check health changes
    const healthDiff = player.health - startState.health;
    if (Math.abs(healthDiff) > 10) {
      changes.push({
        description: `Health changed by ${healthDiff}`,
        significance: Math.min(Math.abs(healthDiff) / 100, 1)
      });
    }

    // Check position changes
    const distance = Math.sqrt(
      Math.pow(player.position.x - startState.position.x, 2) +
      Math.pow(player.position.y - startState.position.y, 2)
    );
    if (distance > 100) {
      changes.push({
        description: `Position changed significantly`,
        significance: Math.min(distance / 1000, 1)
      });
    }

    // Check weapon changes
    const weaponChanges = player.weapons
      .map(w => w.name)
      .filter(w => !startState.weapons.includes(w));
    if (weaponChanges.length > 0) {
      changes.push({
        description: `Weapons changed: ${weaponChanges.join(', ')}`,
        significance: 0.5
      });
    }

    // Check money changes
    const moneyDiff = player.money - startState.money;
    if (Math.abs(moneyDiff) > 1000) {
      changes.push({
        description: `Money changed by ${moneyDiff}`,
        significance: Math.min(Math.abs(moneyDiff) / 10000, 1)
      });
    }

    // Check score changes
    const scoreDiff = currentState.processed.teamState.score - startState.score;
    if (scoreDiff !== 0) {
      changes.push({
        description: `Score changed by ${scoreDiff}`,
        significance: 1
      });
    }

    return changes;
  }

  /**
   * Infer suggestion outcome from state changes
   */
  private async inferOutcome(
    tracker: SuggestionTracker,
    currentState: GameStateSnapshot
  ): Promise<SuggestionTracker['outcome'] | null> {
    const checkpoints = tracker.monitoring.checkpoints;
    if (checkpoints.length === 0) return null;

    // Analyze changes for suggestion adherence
    const changes = checkpoints.flatMap(cp => cp.changes);
    const followed = this.inferSuggestionFollowed(
      tracker.suggestion,
      changes,
      currentState
    );

    // Determine success and impact
    let success = false;
    let impact = 0;

    switch (tracker.suggestion.type) {
      case 'tactical_advice':
        // Success if followed and survived or got kills
        success = followed && (
          currentState.processed.playerState.health > 0 ||
          currentState.processed.playerState.statistics.kills >
            tracker.context.gameState.processed.playerState.statistics.kills
        );
        impact = success ? 0.8 : (followed ? -0.2 : -0.5);
        break;

      case 'strategic_guidance':
        // Success if objective achieved (e.g., round won)
        const scoreDiff = currentState.processed.teamState.score -
          tracker.context.gameState.processed.teamState.score;
        success = scoreDiff > 0;
        impact = success ? 1 : (followed ? 0.2 : -0.3);
        break;

      case 'error_correction':
        // Success if error not repeated
        success = !changes.some(c => 
          c.toLowerCase().includes('error') ||
          c.toLowerCase().includes('mistake')
        );
        impact = success ? 0.6 : -0.4;
        break;

      default:
        // Generic success criteria
        success = followed && checkpoints.some(cp => cp.significance > 0.7);
        impact = success ? 0.5 : (followed ? 0 : -0.2);
    }

    // Extract learning points
    const learningPoints = this.extractLearningPoints(
      tracker,
      changes,
      success,
      followed
    );

    return {
      followed,
      success,
      impact,
      learningPoints
    };
  }

  /**
   * Infer if suggestion was followed
   */
  private inferSuggestionFollowed(
    suggestion: CoachingOutput,
    changes: string[],
    currentState: GameStateSnapshot
  ): boolean {
    // Extract action items
    const actions = suggestion.actionItems.map(item => 
      item.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    );

    // Look for changes that match action items
    const matchingChanges = changes.filter(change => {
      const normalizedChange = change.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return actions.some(action => 
        normalizedChange.includes(action) ||
        this.areSemanticallySimilar(normalizedChange, action)
      );
    });

    return matchingChanges.length > 0;
  }

  /**
   * Extract learning points from suggestion outcome
   */
  private extractLearningPoints(
    tracker: SuggestionTracker,
    changes: string[],
    success: boolean,
    followed: boolean
  ): string[] {
    const points: string[] = [];

    // Add points about suggestion effectiveness
    if (success && followed) {
      points.push(
        `Suggestion "${tracker.suggestion.title}" was effective when followed`
      );
    } else if (!success && followed) {
      points.push(
        `Suggestion "${tracker.suggestion.title}" may need refinement - followed but unsuccessful`
      );
    } else if (!followed) {
      points.push(
        `Suggestion "${tracker.suggestion.title}" was not followed - may need better presentation`
      );
    }

    // Add points about timing and context
    const responseTime = tracker.monitoring.checkpoints[0]?.timestamp.getTime() -
      tracker.timestamp.getTime();
    if (responseTime > 5000) {
      points.push('Player response time was slow - consider simplifying suggestion');
    }

    // Add points about impact
    const significantChanges = tracker.monitoring.checkpoints
      .filter(cp => cp.significance > 0.7)
      .map(cp => cp.changes)
      .flat();
    if (significantChanges.length > 0) {
      points.push(
        `Significant changes observed: ${significantChanges.join(', ')}`
      );
    }

    return points;
  }

  /**
   * Check if two strings are semantically similar
   */
  private areSemanticallySimilar(str1: string, str2: string): boolean {
    // Simple word overlap check - could be enhanced with NLP
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    const overlap = new Set([...words1].filter(x => words2.has(x)));
    return overlap.size > 0;
  }

  /**
   * Finalize suggestion monitoring and store results
   */
  private async finalizeSuggestion(id: string): Promise<void> {
    const tracker = this.activeSuggestions.get(id);
    if (!tracker || !tracker.outcome) return;

    // Store interaction in memory
    const interaction: InteractionHistoryData = {
      steamId: tracker.context.gameState.processed.playerState.steamId,
      playerName: tracker.context.gameState.processed.playerState.name,
      sessionId: 'current', // TODO: Get from session manager
      interactionType: InteractionType.COACHING_FEEDBACK,
      context: tracker.suggestion.details || '',
      feedbackGiven: tracker.suggestion.message,
      playerReaction: tracker.outcome.followed
        ? PlayerReaction.ENGAGED
        : PlayerReaction.RESISTANT,
      reactionDetails: tracker.outcome.learningPoints.join('. '),
      effectiveness: (tracker.outcome.impact + 1) / 2, // Convert -1..1 to 0..1
      followUp: tracker.monitoring.checkpoints.map(cp => ({
        timestamp: cp.timestamp,
        observation: cp.changes.join(', '),
        improvement: cp.significance > 0.5
      })),
      gameState: {
        mapName: tracker.context.gameState.raw.map.name,
        roundNumber: tracker.context.gameState.raw.map.round || 0,
        teamSide: tracker.context.gameState.processed.teamState.side,
        score: {
          team: tracker.context.gameState.processed.teamState.score,
          opponent: 0 // TODO: Get opponent score
        },
        economyState: tracker.context.gameState.processed.teamState.economy.buyCapability,
        playersAlive: 5 // TODO: Calculate from game state
      }
    };

    await this.memoryService.store({
      type: MemoryType.INTERACTION_HISTORY,
      importance: MemoryImportance.HIGH,
      tags: ['interaction', 'correction', 'feedback'],
      data: interaction,
      content: `Auto-correction feedback provided: ${tracker.outcome.learningPoints.join('. ')}`,
      metadata: {
        correctionType: 'auto',
        confidence: 0.85,
        source: 'AutoCorrectionEngine'
      }
    });

    // Update adaptation stats
    this.updateAdaptationStats(tracker);

    // Remove from active tracking
    this.activeSuggestions.delete(id);

    // Emit outcome event
    this.emit(AutoCorrectionEvent.OUTCOME_DETECTED, {
      id,
      outcome: tracker.outcome,
      learningPoints: tracker.outcome.learningPoints
    });
  }

  /**
   * Update adaptation statistics
   */
  private updateAdaptationStats(tracker: SuggestionTracker): void {
    if (!tracker.outcome) return;

    const category = tracker.suggestion.type;
    const stats = this.adaptationStats.get(category) || {
      totalSuggestions: 0,
      successfulSuggestions: 0,
      followedSuggestions: 0,
      averageImpact: 0,
      lastAdapted: new Date(0)
    };

    // Update stats
    stats.totalSuggestions++;
    if (tracker.outcome.success) stats.successfulSuggestions++;
    if (tracker.outcome.followed) stats.followedSuggestions++;
    stats.averageImpact = (
      stats.averageImpact * (stats.totalSuggestions - 1) +
      tracker.outcome.impact
    ) / stats.totalSuggestions;
    stats.lastAdapted = new Date();

    this.adaptationStats.set(category, stats);

    // Check if we should adapt approach
    if (stats.totalSuggestions >= this.config.minSamplesForAdaptation) {
      const successRate = stats.successfulSuggestions / stats.totalSuggestions;
      const followRate = stats.followedSuggestions / stats.totalSuggestions;

      if (successRate < 0.5 || followRate < 0.3) {
        this.emit(AutoCorrectionEvent.APPROACH_ADAPTED, {
          category,
          stats: {
            successRate,
            followRate,
            averageImpact: stats.averageImpact
          },
          suggestedChanges: [
            successRate < 0.5
              ? 'Consider simplifying suggestions or providing more context'
              : null,
            followRate < 0.3
              ? 'Consider adjusting suggestion timing or presentation'
              : null
          ].filter(Boolean)
        });
      }
    }
  }

  /**
   * Parse GSI data into game state snapshot
   */
  private async parseGameState(gsiData: CSGO): Promise<GameStateSnapshot> {
    // Fix the RoundType values
    const economyState: EconomyState = {
      roundType: 'full_buy',
      teamAdvantage: 'balanced',
      nextRoundPrediction: {
        T: 'full_buy',
        CT: 'full_buy'
      }
    };

    // Fix the null check return
    if (!gsiData.player) {
      return {
        raw: gsiData,
        processed: {
          context: 'mid_round' as GameContext,
          phase: 'unknown',
          playerState: {} as PlayerGameState,
          teamState: {} as TeamGameState,
          mapState: {} as MapGameState,
          economyState: economyState,
          situationalFactors: []
        },
        timestamp: new Date(),
        sequenceId: '0'
      };
    }

    // Fix position and weapons type conversion
    const playerState: PlayerGameState = {
      steamId: gsiData.player.steamid,
      name: gsiData.player.name,
      health: gsiData.player.state.health,
      armor: gsiData.player.state.armor,
      money: gsiData.player.state.money,
      position: {
        x: gsiData.player.position[0] || 0,
        y: gsiData.player.position[1] || 0,
        z: gsiData.player.position[2] || 0
      },
      weapons: Object.values(gsiData.player.weapons).map(w => ({
        name: w.name,
        type: (w.type || 'rifle') as 'rifle' | 'pistol' | 'sniper' | 'smg' | 'shotgun' | 'grenade',
        ammo: w.ammo_clip
      })),
      equipment: {
        flash: gsiData.player.state.flashed || 0,
        smoke: gsiData.player.state.smoked || 0,
        molotov: gsiData.player.state.burning || 0,
        he: 0,
        defusekit: gsiData.player.state.defusekit || false
      },
      statistics: {
        kills: gsiData.player.state.round_kills || 0,
        deaths: gsiData.player.state.round_totaldmg || 0,
        assists: gsiData.player.state.round_killhs || 0,
        adr: gsiData.player.state.round_totaldmg || 0,
        rating: 1.0,
        flashAssists: 0,
        enemiesFlashed: 0,
        utilityDamage: 0,
        enemiesBlocked: 0
      },
      observedBehaviors: [],
      riskFactors: [],
      opportunities: []
    };

    // TODO: Implement proper GSI parsing
    return {
      raw: gsiData,
      processed: {
        context: GameContext.MID_ROUND,
        phase: 'live',
        playerState: playerState,
        teamState: {
          side: 'CT',
          score: 0,
          economy: {
            totalMoney: 0,
            averageMoney: 0,
            buyCapability: 'full_buy'
          },
          formation: '',
          strategy: '',
          communication: {
            activity: 0,
            coordination: 0
          },
          mapControl: 0 // Default to 0 (no map control)
        },
        mapState: {
          name: gsiData.map.name,
          round: gsiData.map.round || 0,
          phase: gsiData.map.phase,
          bombState: 'none',
          controlledAreas: {
            T: [],
            CT: [],
            contested: []
          }
        },
        economyState: economyState,
        situationalFactors: []
      },
      timestamp: new Date(),
      sequenceId: Date.now().toString()
    };
  }

  /**
   * Prune old suggestions from tracking
   */
  private pruneOldSuggestions(): void {
    const now = Date.now();
    for (const [id, tracker] of this.activeSuggestions) {
      if (now > tracker.monitoring.monitorUntil.getTime()) {
        this.activeSuggestions.delete(id);
      }
    }
  }
} 