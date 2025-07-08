import { EventEmitter } from 'events';
import { CSGO } from 'csgogsi';
import {
  GameStateSnapshot,
  CoachingObjective,
  InterventionPriority,
  CoachingOutput,
  ExecutionOutcome
} from '../orchestrator/OrchestratorArchitecture.js';
import { AutoCorrectionEngine } from '../AutoCorrectionEngine.js';
import { MemoryService } from '../memory/MemoryService.js';
import {
  InteractionType,
  PlayerReaction,
  InteractionHistoryData,
  MemoryType,
  MemoryImportance
} from '../interfaces/MemoryService.js';

/**
 * Feedback loop events
 */
enum FeedbackLoopEvent {
  FEEDBACK_RECEIVED = 'feedback-received',
  LEARNING_UPDATED = 'learning-updated',
  STRATEGY_ADAPTED = 'strategy-adapted',
  MEMORY_UPDATED = 'memory-updated'
}

/**
 * Feedback data structure
 */
interface FeedbackData {
  suggestionId: string;
  timestamp: Date;
  playerResponse: PlayerReaction;
  gameState: GameStateSnapshot;
  outcome: ExecutionOutcome;
  learningPoints: string[];
  adaptationRecommendations: string[];
}

/**
 * Learning strategy configuration
 */
interface LearningConfig {
  learningRate: number; // How quickly to adapt to new feedback (0-1)
  minSamplesForStrategy: number; // Minimum samples before strategy adaptation
  maxHistorySize: number; // Maximum feedback history size per category
  strategyUpdateInterval: number; // Milliseconds between strategy updates
  confidenceThreshold: number; // Minimum confidence for strategy changes (0-1)
}

/**
 * Main feedback loop manager implementation
 */
export class FeedbackLoopManager extends EventEmitter {
  private autoCorrectionEngine: AutoCorrectionEngine;
  private memoryService: MemoryService;
  private config: LearningConfig;
  private feedbackHistory: Map<string, FeedbackData[]>;
  private strategyStats: Map<string, {
    totalFeedback: number;
    positiveOutcomes: number;
    negativeOutcomes: number;
    averageConfidence: number;
    lastUpdate: Date;
    adaptations: Array<{
      timestamp: Date;
      reason: string;
      impact: number;
    }>;
  }>;

  constructor(
    autoCorrectionEngine: AutoCorrectionEngine,
    memoryService: MemoryService,
    config?: Partial<LearningConfig>
  ) {
    super();
    this.autoCorrectionEngine = autoCorrectionEngine;
    this.memoryService = memoryService;
    this.feedbackHistory = new Map();
    this.strategyStats = new Map();

    // Initialize configuration with defaults
    this.config = {
      learningRate: 0.1,
      minSamplesForStrategy: 10,
      maxHistorySize: 100,
      strategyUpdateInterval: 300000, // 5 minutes
      confidenceThreshold: 0.7,
      ...config
    };

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Process new feedback data
   */
  async processFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Store feedback in history
      await this.storeFeedback(feedback);

      // Update memory with feedback
      await this.updateMemory(feedback);

      // Update learning stats
      this.updateLearningStats(feedback);

      // Check if strategy adaptation is needed
      await this.checkStrategyAdaptation(this.getCategoryFromOutcome(feedback.outcome));

      // Emit feedback event
      this.emit(FeedbackLoopEvent.FEEDBACK_RECEIVED, feedback);

    } catch (error) {
      console.error('Error processing feedback:', error);
      throw error;
    }
  }

  /**
   * Get learning statistics
   */
  getLearningStats(): Array<{
    category: string;
    totalFeedback: number;
    successRate: number;
    confidence: number;
    lastUpdate: Date;
    recentAdaptations: Array<{
      timestamp: Date;
      reason: string;
      impact: number;
    }>;
  }> {
    return Array.from(this.strategyStats.entries()).map(([category, stats]) => ({
      category,
      totalFeedback: stats.totalFeedback,
      successRate: stats.positiveOutcomes / stats.totalFeedback,
      confidence: stats.averageConfidence,
      lastUpdate: stats.lastUpdate,
      recentAdaptations: stats.adaptations.slice(-5) // Last 5 adaptations
    }));
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for auto-correction engine events
    this.autoCorrectionEngine.on('outcome-detected', async (data: any) => {
      const feedback: FeedbackData = {
        suggestionId: data.id,
        timestamp: new Date(),
        playerResponse: this.inferPlayerResponse(data),
        gameState: data.gameState,
        outcome: data.outcome,
        learningPoints: data.learningPoints,
        adaptationRecommendations: this.generateRecommendations(data)
      };
      await this.processFeedback(feedback);
    });
  }

  /**
   * Store feedback in history
   */
  private async storeFeedback(feedback: FeedbackData): Promise<void> {
    const category = this.getCategoryFromOutcome(feedback.outcome);
    
    // Get or initialize history for category
    let history = this.feedbackHistory.get(category) || [];
    
    // Add new feedback
    history.push(feedback);
    
    // Limit history size
    if (history.length > this.config.maxHistorySize) {
      history = history.slice(-this.config.maxHistorySize);
    }
    
    // Update history
    this.feedbackHistory.set(category, history);
  }

  /**
   * Update memory with feedback
   */
  private async updateMemory(feedback: FeedbackData): Promise<void> {
    try {
      // Create interaction history entry
      const interactionData: InteractionHistoryData = {
        steamId: feedback.gameState.raw.player?.steamid || '',
        playerName: feedback.gameState.raw.player?.name || '',
        sessionId: feedback.suggestionId,
        interactionType: InteractionType.COACHING_FEEDBACK,
        context: feedback.gameState.processed.context,
        feedbackGiven: feedback.outcome.learningPoints.join(', '),
        playerReaction: feedback.playerResponse,
        reactionDetails: feedback.outcome.success ? 'Positive outcome' : 'Needs improvement',
        effectiveness: feedback.outcome.impact,
        followUp: [],
        gameState: {
          mapName: feedback.gameState.raw.map?.name || '',
          roundNumber: feedback.gameState.raw.map?.round || 0,
          teamSide: (feedback.gameState.raw.player?.team?.side || 'CT') as 'CT' | 'T',
          score: {
            team: feedback.gameState.raw.map?.team_ct?.score || 0,
            opponent: feedback.gameState.raw.map?.team_t?.score || 0
          },
          economyState: feedback.gameState.processed.economyState.roundType,
          playersAlive: this.getAlivePlayers(feedback.gameState.raw)
        }
      };

      // Store in memory service
      await this.memoryService.store({
        type: MemoryType.INTERACTION_HISTORY,
        importance: this.determineImportance(feedback),
        data: interactionData,
        tags: this.generateMemoryTags(feedback),
        metadata: {
          timestamp: feedback.timestamp,
          success: feedback.outcome.success,
          impact: feedback.outcome.impact
        }
      });

      this.emit(FeedbackLoopEvent.MEMORY_UPDATED, {
        feedback,
        memoryData: interactionData
      });

    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  /**
   * Update learning statistics
   */
  private updateLearningStats(feedback: FeedbackData): void {
    const category = this.getCategoryFromOutcome(feedback.outcome);
    
    // Get or initialize stats
    const stats = this.strategyStats.get(category) || {
      totalFeedback: 0,
      positiveOutcomes: 0,
      negativeOutcomes: 0,
      averageConfidence: 0,
      lastUpdate: new Date(),
      adaptations: []
    };
    
    // Update stats
    stats.totalFeedback++;
    if (feedback.outcome.success) {
      stats.positiveOutcomes++;
    } else {
      stats.negativeOutcomes++;
    }
    
    // Update confidence using exponential moving average
    const newConfidence = feedback.outcome.metadata?.confidence || 0;
    stats.averageConfidence = (stats.averageConfidence * (1 - this.config.learningRate)) +
      (newConfidence * this.config.learningRate);
    
    // Update timestamp
    stats.lastUpdate = new Date();
    
    // Store updated stats
    this.strategyStats.set(category, stats);
  }

  /**
   * Check if strategy adaptation is needed
   */
  private async checkStrategyAdaptation(category: string): Promise<void> {
    const stats = this.strategyStats.get(category);
    if (!stats) return Promise.resolve();

    const now = new Date();
    const timeSinceUpdate = now.getTime() - stats.lastUpdate.getTime();

    // Check if enough time has passed and we have enough samples
    if (
      timeSinceUpdate >= this.config.strategyUpdateInterval &&
      stats.totalFeedback >= this.config.minSamplesForStrategy
    ) {
      const successRate = stats.positiveOutcomes / stats.totalFeedback;
      const confidence = stats.averageConfidence;

      // Determine if adaptation is needed
      if (
        (successRate < 0.5 && confidence > this.config.confidenceThreshold) ||
        (successRate < 0.3)
      ) {
        return this.adaptStrategy(category, stats);
      }
    }

    return Promise.resolve();
  }

  /**
   * Adapt strategy based on learning
   */
  private async adaptStrategy(
    category: string,
    stats: NonNullable<ReturnType<typeof this.strategyStats.get>>
  ): Promise<void> {
    try {
      // Get recent feedback for analysis
      const recentFeedback = this.feedbackHistory.get(category) || [];
      
      // Analyze patterns in unsuccessful cases
      const unsuccessfulFeedback = recentFeedback.filter(f => !f.outcome.success);
      const commonPatterns = this.analyzePatterns(unsuccessfulFeedback);
      
      // Generate adaptation recommendations
      const recommendations = this.generateAdaptationRecommendations(
        commonPatterns,
        stats
      );
      
      // Record adaptation
      stats.adaptations.push({
        timestamp: new Date(),
        reason: recommendations[0], // Primary recommendation
        impact: 0 // Will be updated when we see results
      });
      
      // Limit adaptations history
      if (stats.adaptations.length > 10) {
        stats.adaptations = stats.adaptations.slice(-10);
      }
      
      // Update stats
      this.strategyStats.set(category, stats);
      
      // Emit adaptation event
      this.emit(FeedbackLoopEvent.STRATEGY_ADAPTED, {
        category,
        patterns: commonPatterns,
        recommendations,
        stats: {
          successRate: stats.positiveOutcomes / stats.totalFeedback,
          confidence: stats.averageConfidence,
          totalSamples: stats.totalFeedback
        }
      });

    } catch (error) {
      console.error('Error adapting strategy:', error);
      throw error;
    }
  }

  /**
   * Analyze patterns in feedback
   */
  private analyzePatterns(feedback: FeedbackData[]): Array<{
    pattern: string;
    frequency: number;
    impact: number;
  }> {
    const patterns = new Map<string, { count: number; totalImpact: number }>();

    // Analyze each feedback entry
    for (const entry of feedback) {
      // Add learning points as patterns
      for (const point of entry.learningPoints) {
        const existing = patterns.get(point) || { count: 0, totalImpact: 0 };
        existing.count++;
        existing.totalImpact += entry.outcome.impact || 0;
        patterns.set(point, existing);
      }

      // Add adaptation recommendations as patterns
      for (const rec of entry.adaptationRecommendations) {
        const existing = patterns.get(rec) || { count: 0, totalImpact: 0 };
        existing.count++;
        existing.totalImpact += entry.outcome.impact || 0;
        patterns.set(rec, existing);
      }
    }

    // Convert to array and calculate averages
    return Array.from(patterns.entries())
      .map(([pattern, stats]) => ({
        pattern,
        frequency: stats.count / feedback.length,
        impact: stats.totalImpact / stats.count
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Generate adaptation recommendations
   */
  private generateAdaptationRecommendations(
    patterns: Array<{ pattern: string; frequency: number; impact: number }>,
    stats: NonNullable<ReturnType<typeof this.strategyStats.get>>
  ): string[] {
    const recommendations: string[] = [];

    // Add recommendations based on patterns
    for (const { pattern, frequency, impact } of patterns) {
      if (frequency > 0.3) { // Pattern occurs in >30% of cases
        recommendations.push(
          `High frequency pattern (${Math.round(frequency * 100)}%): ${pattern}`
        );
      }
      if (impact < -0.5) { // Pattern has strong negative impact
        recommendations.push(
          `High negative impact pattern: ${pattern}`
        );
      }
    }

    // Add recommendations based on stats
    const successRate = stats.positiveOutcomes / stats.totalFeedback;
    if (successRate < 0.3) {
      recommendations.push(
        'Very low success rate - consider major strategy revision'
      );
    } else if (successRate < 0.5) {
      recommendations.push(
        'Below average success rate - adjust approach for better outcomes'
      );
    }

    if (stats.averageConfidence < this.config.confidenceThreshold) {
      recommendations.push(
        'Low confidence in current approach - gather more data or revise strategy'
      );
    }

    return recommendations;
  }

  /**
   * Infer player response from outcome data
   */
  private inferPlayerResponse(data: any): PlayerReaction {
    if (data.outcome.followed) {
      return data.outcome.success
        ? PlayerReaction.POSITIVE
        : PlayerReaction.NEUTRAL;
    }
    return PlayerReaction.RESISTANT;
  }

  /**
   * Get category from outcome
   */
  private getCategoryFromOutcome(outcome: ExecutionOutcome): string {
    // Since ExecutionOutcome doesn't have a type property, use the success status
    return outcome.success ? 'successful' : 'unsuccessful';
  }

  /**
   * Determine memory importance
   */
  private determineImportance(feedback: FeedbackData): MemoryImportance {
    // High importance for significant outcomes
    if (Math.abs(feedback.outcome.impact) > 0.8) {
      return MemoryImportance.HIGH;
    }

    // Medium importance for moderate impact
    if (Math.abs(feedback.outcome.impact) > 0.4) {
      return MemoryImportance.MEDIUM;
    }

    return MemoryImportance.LOW;
  }

  /**
   * Generate memory tags
   */
  private generateMemoryTags(feedback: FeedbackData): string[] {
    const tags: string[] = [
      `outcome_${feedback.outcome.success ? 'success' : 'failure'}`,
      `response_${feedback.playerResponse.toLowerCase()}`,
      'coaching_feedback'
    ];

    // Add impact level tag
    const impact = feedback.outcome.impact;
    if (Math.abs(impact) > 0.8) {
      tags.push('impact_high');
    } else if (Math.abs(impact) > 0.4) {
      tags.push('impact_medium');
    } else {
      tags.push('impact_low');
    }

    return tags;
  }

  /**
   * Generate recommendations from outcome data
   */
  private generateRecommendations(data: any): string[] {
    const recommendations: string[] = [];

    // Add timing-based recommendations
    if (data.timing && data.timing.responseTime > 5000) {
      recommendations.push(
        'Consider simplifying suggestions for faster response'
      );
    }

    // Add outcome-based recommendations
    if (!data.outcome.followed) {
      recommendations.push(
        'Improve suggestion clarity or relevance to increase adoption'
      );
    }
    if (!data.outcome.success && data.outcome.followed) {
      recommendations.push(
        'Review suggestion effectiveness in similar situations'
      );
    }

    // Add context-based recommendations
    if (data.gameState) {
      const context = data.gameState.processed.context;
      if (context === 'CRITICAL_SITUATION') {
        recommendations.push(
          'Prioritize immediate, actionable suggestions in critical moments'
        );
      }
    }

    return recommendations;
  }

  private getAlivePlayers(data: CSGO): number {
    const players = Object.values(data.players || {});
    return players.filter(p => p && p.state?.health > 0).length;
  }
} 