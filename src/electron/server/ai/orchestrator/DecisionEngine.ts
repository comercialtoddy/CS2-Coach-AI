/**
 * GSI-Driven Decision Engine
 * 
 * This is the core intelligence of the AI coaching system that analyzes game state
 * and makes intelligent decisions about which tools to invoke and in what sequence.
 * It implements sophisticated decision-making logic based on real-time GSI data,
 * player context, and coaching objectives.
 */

import { EventEmitter } from 'events';
import {
  IDecisionEngine,
  AIDecisionContext,
  AIDecision,
  ToolChainStep,
  UserFeedback,
  ExecutionOutcome,
  CoachingObjective,
  GameContext,
  InterventionPriority,
  SituationalFactor,
  GameStateSnapshot,
  PlayerGameState,
  TeamGameState,
  EconomyState
} from './OrchestratorArchitecture.js';
import { BaseMemoryEntry, MemoryType, ImportanceLevel } from '../interfaces/MemoryService.js';
import { ToolManager } from '../ToolManager.js';

type ToolName =
  | 'Tool_GetGSIInfo'
  | 'Tool_AnalyzePositioning'
  | 'Tool_CallLLM'
  | 'Tool_PiperTTS'
  | 'Tool_SuggestEconomyBuy'
  | 'Tool_GetTrackerGGStats'
  | 'Tool_UpdatePlayerProfile'
  | 'Tool_SummarizeConversation';

/**
 * Decision rule for contextual analysis
 */
interface DecisionRule {
  id: string;
  name: string;
  contexts: GameContext[];
  conditions: (context: AIDecisionContext) => boolean;
  toolChain: string[];
  priority: InterventionPriority;
  confidence: number;
  description: string;
  cooldown?: number; // Minimum time between applications (ms)
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
 * Coaching style adaptation
 */
interface CoachingStyleAdaptation {
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
  feedback?: UserFeedback;
  adjustment?: string;
}

/**
 * Decision learning data
 */
interface DecisionLearning {
  ruleId: string;
  successRate: number;
  averageUserRating: number;
  totalApplications: number;
  lastUsed: Date;
  adaptations: CoachingStyleAdaptation[];
  playerPreferences?: {
    feedbackStyle: string;
    detailLevel: string;
    interventionFrequency: string;
  };
  effectivePatterns: {
    context: string[];
    toolChain: string[];
    successRate: number;
    applications: number;
  }[];
}

/**
 * Analysis result for decision making
 */
interface ContextAnalysis {
  gameContext: GameContext;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  coachingNeeds: CoachingObjective[];
  situationalFactors: SituationalFactor[];
  playerBehaviorPatterns: string[];
  recommendedInterventions: {
    type: string;
    rationale: string;
    tools: string[];
    priority: InterventionPriority;
  }[];
}

/**
 * Core GSI-driven decision engine implementation
 */
export class GSIDecisionEngine extends EventEmitter implements IDecisionEngine {
  private toolManager: ToolManager;
  private decisionRules: Map<string, DecisionRule>;
  private learningData: Map<string, DecisionLearning>;
  private recentDecisions: Map<string, Date>;
  private config: {
    maxDecisionsPerAnalysis: number;
    minConfidenceThreshold: number;
    learningRate: number;
    enableAdaptiveLearning: boolean;
    defaultCooldownMs: number;
  };

  private toolTimeouts: Record<ToolName, number>;
  private toolFallbacks: Record<ToolName, string | undefined>;
  private toolOutputs: Record<ToolName, string>;
  private toolComplexities: Record<ToolName, number>;

  private adaptiveConfig: AdaptiveCoachingConfig;
  private lastDecisionTimestamp: Map<string, number>;
  private readonly COOLDOWN_MS = 5000; // 5 seconds cooldown between similar decisions

  constructor(toolManager: ToolManager) {
    super();
    this.toolManager = toolManager;
    this.decisionRules = new Map();
    this.learningData = new Map();
    this.recentDecisions = new Map();
    
    this.config = {
      maxDecisionsPerAnalysis: 3,
      minConfidenceThreshold: 0.6,
      learningRate: 0.1,
      enableAdaptiveLearning: true,
      defaultCooldownMs: 30000 // 30 seconds
    };

    this.adaptiveConfig = {
      learningRate: 0.1,
      minConfidence: 0.6,
      maxAdaptations: 5,
      adaptationThreshold: 0.2,
      cooldownPeriod: 30000 // 30 seconds
    };

    this.initializeDecisionRules();

    this.toolTimeouts = {
      Tool_GetGSIInfo: 1000,
      Tool_AnalyzePositioning: 5000,
      Tool_CallLLM: 15000,
      Tool_PiperTTS: 8000,
      Tool_SuggestEconomyBuy: 3000,
      Tool_GetTrackerGGStats: 10000,
      Tool_UpdatePlayerProfile: 2000,
      Tool_SummarizeConversation: 12000
    };

    this.toolFallbacks = {
      Tool_GetGSIInfo: undefined,
      Tool_AnalyzePositioning: 'Tool_SummarizeConversation',
      Tool_CallLLM: undefined,
      Tool_PiperTTS: undefined,
      Tool_SuggestEconomyBuy: 'Tool_CallLLM',
      Tool_GetTrackerGGStats: 'Tool_CallLLM',
      Tool_UpdatePlayerProfile: undefined,
      Tool_SummarizeConversation: undefined
    };

    this.toolOutputs = {
      Tool_GetGSIInfo: 'Returns structured game state information.',
      Tool_AnalyzePositioning: 'Returns analysis of player positioning.',
      Tool_CallLLM: 'Returns a text response from the language model.',
      Tool_PiperTTS: 'Returns an audio file or stream.',
      Tool_SuggestEconomyBuy: 'Returns buy suggestions for the team.',
      Tool_GetTrackerGGStats: 'Returns player statistics from Tracker.gg.',
      Tool_UpdatePlayerProfile: 'Returns confirmation of player profile update.',
      Tool_SummarizeConversation: 'Returns a summary of the conversation.'
    };

    this.toolComplexities = {
      Tool_GetGSIInfo: 1,
      Tool_AnalyzePositioning: 5,
      Tool_CallLLM: 8,
      Tool_PiperTTS: 4,
      Tool_SuggestEconomyBuy: 3,
      Tool_GetTrackerGGStats: 6,
      Tool_UpdatePlayerProfile: 2,
      Tool_SummarizeConversation: 7
    };

    this.lastDecisionTimestamp = new Map();
  }

  /**
   * Initialize predefined decision rules for different game contexts
   */
  private initializeDecisionRules(): void {
    const rules: DecisionRule[] = [
      // Critical Situation Analysis
      {
        id: 'critical_position_analysis',
        name: 'Critical Positioning Analysis',
        contexts: [GameContext.CRITICAL_SITUATION, GameContext.MID_ROUND],
        conditions: (context) => this.isCriticalPositioning(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_AnalyzePositioning', 'Tool_CallLLM', 'Tool_PiperTTS'],
        priority: InterventionPriority.IMMEDIATE,
        confidence: 0.9,
        description: 'Analyze and provide immediate positioning advice in critical situations',
        cooldown: 15000
      },

      // Economy Management
      {
        id: 'economy_buy_suggestion',
        name: 'Economy Buy Suggestion',
        contexts: [GameContext.ECONOMY_PHASE, GameContext.ROUND_START],
        conditions: (context) => this.needsEconomyAdvice(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_SuggestEconomyBuy', 'Tool_CallLLM', 'Tool_PiperTTS'],
        priority: InterventionPriority.HIGH,
        confidence: 0.8,
        description: 'Provide strategic buy recommendations based on team economy',
        cooldown: 25000
      },

      // Performance Feedback
      {
        id: 'performance_review',
        name: 'Performance Review',
        contexts: [GameContext.ROUND_END, GameContext.LEARNING_OPPORTUNITY],
        conditions: (context) => this.hasPerformanceInsights(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_GetTrackerGGStats', 'Tool_CallLLM', 'Tool_UpdatePlayerProfile'],
        priority: InterventionPriority.MEDIUM,
        confidence: 0.7,
        description: 'Analyze performance and provide constructive feedback',
        cooldown: 45000
      },

      // Tactical Guidance
      {
        id: 'tactical_strategy',
        name: 'Tactical Strategy Guidance',
        contexts: [GameContext.ROUND_START, GameContext.MID_ROUND],
        conditions: (context) => this.needsTacticalGuidance(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_CallLLM', 'Tool_PiperTTS'],
        priority: InterventionPriority.HIGH,
        confidence: 0.75,
        description: 'Provide tactical strategy advice for current game situation',
        cooldown: 20000
      },

      // Mental Coaching
      {
        id: 'mental_support',
        name: 'Mental Support',
        contexts: [GameContext.ROUND_END, GameContext.CRITICAL_SITUATION],
        conditions: (context) => this.needsMentalSupport(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_CallLLM', 'Tool_PiperTTS'],
        priority: InterventionPriority.MEDIUM,
        confidence: 0.65,
        description: 'Provide mental coaching and morale support',
        cooldown: 60000
      },

      // Learning Opportunity
      {
        id: 'learning_insight',
        name: 'Learning Insight',
        contexts: [GameContext.LEARNING_OPPORTUNITY, GameContext.ROUND_END],
        conditions: (context) => this.hasLearningOpportunity(context),
        toolChain: ['Tool_GetGSIInfo', 'Tool_GetTrackerGGStats', 'Tool_CallLLM', 'Tool_SummarizeConversation'],
        priority: InterventionPriority.LOW,
        confidence: 0.6,
        description: 'Identify and explain learning opportunities from recent gameplay',
        cooldown: 30000
      }
    ];

    // Register all rules
    rules.forEach(rule => {
      this.decisionRules.set(rule.id, rule);
      this.learningData.set(rule.id, {
        ruleId: rule.id,
        successRate: rule.confidence,
        averageUserRating: 3.5,
        totalApplications: 0,
        lastUsed: new Date(0),
        adaptations: [],
        effectivePatterns: []
      });
    });

    this.emit('rules-initialized', { count: rules.length });
  }

  /**
   * Main analysis method - analyzes context and generates AI decisions
   */
  async analyzeContext(context: AIDecisionContext): Promise<AIDecision[]> {
    try {
      this.emit('analysis-started', { context: context.gameState.processed.context });

      // Perform deep context analysis
      const analysis = await this.performContextAnalysis(context);
      
      // Apply decision rules and generate decisions
      const potentialDecisions = await this.applyDecisionRules(context, analysis);
      
      // Filter by confidence threshold and cooldowns
      const viableDecisions = this.filterViableDecisions(potentialDecisions);
      
      // Prioritize and limit decisions
      const finalDecisions = this.prioritizeDecisions(viableDecisions)
        .slice(0, this.config.maxDecisionsPerAnalysis);

      // Update usage tracking
      finalDecisions.forEach(decision => {
        this.recentDecisions.set(decision.id, new Date());
      });

      this.emit('analysis-completed', { 
        decisionsGenerated: finalDecisions.length,
        analysisType: analysis.gameContext 
      });

      return finalDecisions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('analysis-error', { error: errorMessage });
      throw new Error(`Decision analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Prioritize decisions based on priority, confidence, and context
   */
  prioritizeDecisions(decisions: AIDecision[]): AIDecision[] {
    return decisions.sort((a, b) => {
      // First by priority (immediate > high > medium > low > deferred)
      const priorityOrder = {
        [InterventionPriority.IMMEDIATE]: 5,
        [InterventionPriority.HIGH]: 4,
        [InterventionPriority.MEDIUM]: 3,
        [InterventionPriority.LOW]: 2,
        [InterventionPriority.DEFERRED]: 1
      };

      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by confidence
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.05) return confidenceDiff;

      // Finally by processing complexity (simpler first for immediate execution)
      return a.metadata.complexity - b.metadata.complexity;
    });
  }

  /**
   * Optimize tool chain for better performance and reliability
   */
  optimizeToolChain(decision: AIDecision): ToolChainStep[] {
    return decision.toolChain.map(step => ({
      ...step,
      timeout: this.calculateOptimalTimeout(step.toolName),
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'linear'
      }
    }));
  }

  /**
   * Adapt decision making based on user feedback
   */
  adaptToFeedback(feedback: UserFeedback): void {
    if (!this.config.enableAdaptiveLearning) return;

    const decision = this.findDecisionByFeedback(feedback);
    if (!decision) return;

    const ruleId = this.extractRuleIdFromDecision(decision);
    const learningData = this.learningData.get(ruleId);
    
    if (learningData) {
      // Update learning metrics
      const weightedRating = feedback.rating * (feedback.helpful ? 1 : 0.5);
      learningData.averageUserRating = this.updateMovingAverage(
        learningData.averageUserRating,
        weightedRating,
        this.config.learningRate
      );

      // Adjust confidence based on feedback
      const rule = this.decisionRules.get(ruleId);
      if (rule) {
        const confidenceAdjustment = this.calculateConfidenceAdjustment(feedback);
        rule.confidence = Math.max(0.1, Math.min(1.0, rule.confidence + confidenceAdjustment));
      }

      // Record adaptation
      learningData.adaptations.push({
        ruleId: ruleId,
        timestamp: new Date(),
        changes: {},
        reason: `Feedback-based adaptation`,
        feedback,
        outcome: null as any, // Will be updated in learnFromOutcome
        adjustment: `Confidence adjusted by ${this.calculateConfidenceAdjustment(feedback)}`
      });

      this.emit('feedback-adapted', { ruleId, feedback, newConfidence: rule?.confidence });
    }
  }

  /**
   * Learn from execution outcomes to improve future decisions
   */
  learnFromOutcome(decision: AIDecision, outcome: ExecutionOutcome): void {
    if (!this.config.enableAdaptiveLearning) return;

    const ruleId = this.extractRuleIdFromDecision(decision);
    const learningData = this.learningData.get(ruleId);
    
    if (learningData) {
      learningData.totalApplications++;
      
      // Update success rate
      const success = outcome.success && outcome.playerResponse !== 'negative';
      learningData.successRate = this.updateMovingAverage(
        learningData.successRate,
        success ? 1 : 0,
        this.config.learningRate
      );

      // Find and update corresponding adaptation record
      const lastAdaptation = learningData.adaptations[learningData.adaptations.length - 1];
      if (lastAdaptation && !lastAdaptation.outcome) {
        lastAdaptation.outcome = outcome;
      }

      // Adjust rule based on outcome
      const rule = this.decisionRules.get(ruleId);
      if (rule) {
        const performanceAdjustment = this.calculatePerformanceAdjustment(outcome);
        rule.confidence = Math.max(0.1, Math.min(1.0, rule.confidence + performanceAdjustment));
      }

      this.emit('outcome-learned', { 
        ruleId, 
        outcome, 
        newSuccessRate: learningData.successRate,
        newConfidence: rule?.confidence 
      });
    }
  }

  /**
   * Apply adaptive coaching adjustments based on learning data
   */
  private applyAdaptiveAdjustments(rule: DecisionRule, context: AIDecisionContext): DecisionRule {
    const learningData = this.learningData.get(rule.id);
    if (!learningData) return rule;

    // Create a copy of the rule to modify
    const adaptedRule: DecisionRule = { ...rule };

    // Check if adaptation is needed
    const needsAdaptation = this.needsAdaptation(learningData);
    if (!needsAdaptation) return rule;

    // Analyze player preferences and patterns
    const playerProfile = this.analyzePlayerProfile(context);
    const effectivePatterns = this.findEffectivePatterns(learningData, context);

    // Adjust rule based on learning data
    this.adjustRulePriority(adaptedRule, learningData, playerProfile);
    this.adjustToolChain(adaptedRule, effectivePatterns);
    this.adjustConfidence(adaptedRule, learningData);
    this.adjustCooldown(adaptedRule, learningData);

    // Record adaptation
    this.recordAdaptation(learningData, adaptedRule, rule);

    return adaptedRule;
  }

  /**
   * Check if a rule needs adaptation
   */
  private needsAdaptation(learning: DecisionLearning): boolean {
    // Check if enough data is available
    if (learning.totalApplications < 5) return false;

    // Check if success rate is below threshold
    if (learning.successRate < this.adaptiveConfig.minConfidence) return true;

    // Check if recent adaptations have been ineffective
    const recentAdaptations = learning.adaptations
      .slice(-this.adaptiveConfig.maxAdaptations);

    if (recentAdaptations.length > 0) {
      const recentSuccess = recentAdaptations
        .filter(a => a.outcome?.success)
        .length / recentAdaptations.length;

      if (recentSuccess < 0.5) return true;
    }

    return false;
  }

  /**
   * Analyze player profile for adaptation
   */
  private analyzePlayerProfile(context: AIDecisionContext): {
    learningStyle: string;
    responseToFeedback: string;
    skillLevel: string;
    adaptability: number;
  } {
    const preferences = context.learningPreferences || {
      style: 'balanced',
      level: 'intermediate',
      frequency: 'moderate'
    };

    const history = context.sessionHistory || [];
    const recentHistory = history.slice(-5);

    const learningStyle = preferences.style;
    const responseToFeedback = this.analyzeResponses(recentHistory);
    const skillLevel = this.determineSkillLevel(context.playerMemory);
    const adaptability = this.calculateAdaptability(recentHistory);

    return {
      learningStyle,
      responseToFeedback,
      skillLevel,
      adaptability
    };
  }

  /**
   * Find effective patterns for the current context
   */
  private findEffectivePatterns(
    learning: DecisionLearning,
    context: AIDecisionContext
  ): DecisionLearning['effectivePatterns'][0] | null {
    if (!learning.effectivePatterns?.length) return null;

    // Get current context tags
    const currentContext = this.extractContextTags(context);

    // Find patterns with similar context and high success rate
    return learning.effectivePatterns
      .filter(pattern => {
        const contextOverlap = pattern.context
          .filter(tag => currentContext.includes(tag))
          .length / pattern.context.length;

        return contextOverlap > 0.7 && pattern.successRate > 0.7;
      })
      .sort((a, b) => b.successRate - a.successRate)[0] || null;
  }

  /**
   * Adjust rule priority based on learning data
   */
  private adjustRulePriority(
    rule: DecisionRule,
    learning: DecisionLearning,
    profile: ReturnType<typeof this.analyzePlayerProfile>
  ): void {
    // Base priority adjustment on success rate
    if (learning.successRate < 0.3) {
      rule.priority = InterventionPriority.LOW;
    } else if (learning.successRate > 0.8) {
      rule.priority = InterventionPriority.HIGH;
    }

    // Consider player's response to feedback
    if (profile.responseToFeedback === 'negative') {
      rule.priority = this.lowerPriority(rule.priority);
    } else if (profile.responseToFeedback === 'positive') {
      rule.priority = this.raisePriority(rule.priority);
    }

    // Consider skill level
    if (profile.skillLevel === 'beginner' && rule.priority === InterventionPriority.LOW) {
      rule.priority = InterventionPriority.MEDIUM;
    }
  }

  /**
   * Adjust tool chain based on effective patterns
   */
  private adjustToolChain(
    rule: DecisionRule,
    effectivePattern: DecisionLearning['effectivePatterns'][0] | null
  ): void {
    if (!effectivePattern) return;

    // Use the tool chain from the effective pattern
    if (effectivePattern.successRate > 0.8) {
      rule.toolChain = effectivePattern.toolChain;
    }

    // Ensure essential tools are included
    const essentialTools = ['Tool_GetGSIInfo', 'Tool_CallLLM'];
    essentialTools.forEach(tool => {
      if (!rule.toolChain.includes(tool)) {
        rule.toolChain.push(tool);
      }
    });
  }

  /**
   * Adjust rule confidence based on learning data
   */
  private adjustConfidence(rule: DecisionRule, learning: DecisionLearning): void {
    // Base confidence on success rate
    const baseConfidence = learning.successRate;

    // Consider total applications for reliability
    const experienceFactor = Math.min(learning.totalApplications / 100, 1);
    
    // Consider recent adaptations
    const recentAdaptations = learning.adaptations.slice(-3);
    const adaptationImpact = recentAdaptations.reduce(
      (sum, adaptation) => sum + (adaptation.outcome?.measuredImpact.performance || 0),
      0
    ) / (recentAdaptations.length || 1);

    // Calculate final confidence
    rule.confidence = Math.min(
      1,
      baseConfidence * 0.6 +
      experienceFactor * 0.2 +
      adaptationImpact * 0.2
    );
  }

  /**
   * Adjust rule cooldown based on learning data
   */
  private adjustCooldown(rule: DecisionRule, learning: DecisionLearning): void {
    const baseCooldown = this.adaptiveConfig.cooldownPeriod;

    // Increase cooldown if frequently ignored
    if (learning.successRate < 0.3) {
      rule.cooldown = baseCooldown * 2;
    }
    // Decrease cooldown if highly successful
    else if (learning.successRate > 0.8) {
      rule.cooldown = baseCooldown * 0.5;
    }
    // Use base cooldown
    else {
      rule.cooldown = baseCooldown;
    }
  }

  /**
   * Record an adaptation for learning
   */
  private recordAdaptation(
    learning: DecisionLearning,
    adaptedRule: DecisionRule,
    originalRule: DecisionRule
  ): void {
    const adaptation: CoachingStyleAdaptation = {
      ruleId: adaptedRule.id,
      timestamp: new Date(),
      changes: {
        priority: adaptedRule.priority !== originalRule.priority ? adaptedRule.priority : undefined,
        confidence: adaptedRule.confidence !== originalRule.confidence ? adaptedRule.confidence : undefined,
        toolChain: !this.arraysEqual(adaptedRule.toolChain, originalRule.toolChain) ? adaptedRule.toolChain : undefined,
        cooldown: adaptedRule.cooldown !== originalRule.cooldown ? adaptedRule.cooldown : undefined
      },
      reason: `Adapted based on learning data (success rate: ${learning.successRate.toFixed(2)})`,
      outcome: undefined
    };

    learning.adaptations.push(adaptation);
  }

  /**
   * Extract context tags from decision context
   */
  private extractContextTags(context: AIDecisionContext): string[] {
    const tags: string[] = [
      context.gameState.processed.phase,
      context.gameState.processed.economyState.roundType,
      context.gameState.processed.teamState.side,
      context.gameState.processed.mapState.name
    ];

    // Add situational factors
    context.gameState.processed.situationalFactors.forEach(factor => {
      if (factor.severity === 'high' || factor.severity === 'critical') {
        tags.push(factor.type);
      }
    });

    // Add coaching objectives
    context.coachingObjectives.forEach(objective => {
      tags.push(objective);
    });

    return tags.filter(Boolean);
  }

  /**
   * Determine player skill level from profile data
   */
  private determineSkillLevel(profileData: any): string {
    if (!profileData?.performance) return 'intermediate';

    const rating = profileData.performance.averageRating || 0;
    if (rating > 1.2) return 'advanced';
    if (rating < 0.8) return 'beginner';
    return 'intermediate';
  }

  /**
   * Analyze player responses to feedback
   */
  private analyzeResponses(responses: any[]): string {
    if (!responses.length) return 'neutral';

    const positiveCount = responses.filter(r => r === 'positive').length;
    const negativeCount = responses.filter(r => r === 'negative').length;

    if (positiveCount > responses.length * 0.6) return 'positive';
    if (negativeCount > responses.length * 0.4) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate player adaptability score
   */
  private calculateAdaptability(responses: any[]): number {
    if (!responses.length) return 0.5;

    // Calculate how often the player successfully adapts to feedback
    const successfulAdaptations = responses.filter(r => r === 'positive').length;
    return successfulAdaptations / responses.length;
  }

  /**
   * Lower priority level
   */
  private lowerPriority(priority: InterventionPriority): InterventionPriority {
    switch (priority) {
      case InterventionPriority.IMMEDIATE:
        return InterventionPriority.HIGH;
      case InterventionPriority.HIGH:
        return InterventionPriority.MEDIUM;
      case InterventionPriority.MEDIUM:
        return InterventionPriority.LOW;
      default:
        return InterventionPriority.LOW;
    }
  }

  /**
   * Raise priority level
   */
  private raisePriority(priority: InterventionPriority): InterventionPriority {
    switch (priority) {
      case InterventionPriority.LOW:
        return InterventionPriority.MEDIUM;
      case InterventionPriority.MEDIUM:
        return InterventionPriority.HIGH;
      case InterventionPriority.HIGH:
        return InterventionPriority.IMMEDIATE;
      default:
        return priority;
    }
  }

  // ===== Private Helper Methods =====

  /**
   * Perform deep analysis of the current context
   */
  private async performContextAnalysis(context: AIDecisionContext): Promise<ContextAnalysis> {
    const gameState = context.gameState;
    const player = gameState.processed.playerState;
    const team = gameState.processed.teamState;
    
    return {
      gameContext: gameState.processed.context,
      urgency: this.calculateUrgency(gameState),
      coachingNeeds: this.identifyCoachingNeeds(context),
      situationalFactors: gameState.processed.situationalFactors,
      playerBehaviorPatterns: this.analyzePlayerBehavior(player, context.playerMemory),
      recommendedInterventions: this.generateInterventionRecommendations(context)
    };
  }

  /**
   * Apply decision rules to context and generate potential decisions
   */
  private async applyDecisionRules(context: AIDecisionContext, analysis: ContextAnalysis): Promise<AIDecision[]> {
    const decisions: AIDecision[] = [];
    
    for (const [ruleId, rule] of Array.from(this.decisionRules.entries())) {
      // Check if rule applies to current context
      if (!rule.contexts.includes(analysis.gameContext)) continue;
      
      // Check rule conditions
      if (!rule.conditions(context)) continue;
      
      // Check cooldown
      if (this.isOnCooldown(ruleId, rule.cooldown || this.config.defaultCooldownMs)) continue;
      
      // Generate decision
      const decision = await this.generateDecisionFromRule(rule, context, analysis);
      if (decision) {
        decisions.push(decision);
      }
    }
    
    return decisions;
  }

  /**
   * Generate a decision from a rule
   */
  private async generateDecisionFromRule(rule: DecisionRule, context: AIDecisionContext, analysis: ContextAnalysis): Promise<AIDecision | null> {
    try {
      const toolChain = this.generateToolChain(rule.toolChain);
      const complexity = this.calculateComplexity(rule.toolChain);

      return {
        id: `${rule.id}_${Date.now()}`,
        type: rule.id,
        priority: rule.priority,
        confidence: rule.confidence,
        rationale: `${rule.description} based on current game state`,
        toolChain,
        context,
        metadata: {
          complexity,
          executionTime: this.estimateProcessingTime(rule.toolChain),
          expectedOutcome: rule.description
        }
      };
    } catch (error) {
      console.error('Failed to generate decision:', error);
      return null;
    }
  }

  /**
   * Filter decisions based on viability criteria
   */
  private filterViableDecisions(decisions: AIDecision[]): AIDecision[] {
    return decisions.filter(decision => {
      // Check cooldown
      const lastUse = this.lastDecisionTimestamp.get(decision.type) || 0;
      if (Date.now() - lastUse < this.COOLDOWN_MS) return false;

      // Resource constraints check
      const executionTime = decision.metadata.executionTime || 0;
      if (executionTime > 30000) return false; // Max 30 seconds
      
      // Risk assessment
      if (decision.metadata.riskLevel === 'high' && decision.confidence < 0.8) return false;
      
      return true;
    });
  }

  // ===== Condition Check Methods =====

  private isCriticalPositioning(context: AIDecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    return player.health < 50 || 
           situationalFactors.some(factor => 
             factor.type === 'positional' && factor.severity === 'critical'
           );
  }

  private needsEconomyAdvice(context: AIDecisionContext): boolean {
    const economy = context.gameState.processed.economyState;
    const team = context.gameState.processed.teamState;

    // Check if team economy is in a challenging state
    if (economy.roundType === 'eco' || economy.roundType === 'semi_eco') {
      return true;
    }

    // Check if team has mixed buy capability
    if (team.economy.buyCapability === 'eco' || team.economy.buyCapability === 'semi_eco') {
      return true;
    }

    return false;
  }

  private hasPerformanceInsights(context: AIDecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    
    // Check for significant performance events
    return player.statistics.rating < 0.5 || 
           player.statistics.deaths > player.statistics.kills + 2 ||
           player.riskFactors.length > 0;
  }

  private needsTacticalGuidance(context: AIDecisionContext): boolean {
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    // Check for critical or high severity factors
    const hasCriticalFactors = situationalFactors.some(
      f => f.severity === 'critical' || f.severity === 'high'
    );

    // Check for tactical factors
    const hasTacticalFactors = situationalFactors.some(
      f => f.type === 'tactical' || f.type === 'positional'
    );

    return hasCriticalFactors || hasTacticalFactors;
  }

  private needsMentalSupport(context: AIDecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    const team = context.gameState.processed.teamState;
    
    // Check for psychological stress indicators
    return player.statistics.deaths > 5 ||
           team.score < (context.gameState.processed.mapState.round * 0.3) ||
           player.riskFactors.includes('tilt') ||
           player.riskFactors.includes('frustration');
  }

  private hasLearningOpportunity(context: AIDecisionContext): boolean {
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    return situationalFactors.some(factor => 
      factor.description.includes('mistake') ||
      factor.description.includes('improvement') ||
      factor.description.includes('opportunity')
    );
  }

  // ===== Utility Methods =====

  private calculateUrgency(gameState: GameStateSnapshot): 'low' | 'medium' | 'high' | 'critical' {
    const criticalFactors = gameState.processed.situationalFactors.filter(f => f.severity === 'critical');
    const highFactors = gameState.processed.situationalFactors.filter(f => f.severity === 'high');
    
    if (criticalFactors.length > 0) return 'critical';
    if (highFactors.length > 1) return 'high';
    if (highFactors.length > 0) return 'medium';
    return 'low';
  }

  private identifyCoachingNeeds(context: AIDecisionContext): CoachingObjective[] {
    const needs: CoachingObjective[] = [];
    const player = context.gameState.processed.playerState;
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    // Performance-based needs
    if (player.statistics.rating < 0.6) {
      needs.push(CoachingObjective.PERFORMANCE_IMPROVEMENT);
    }
    
    // Tactical needs
    if (situationalFactors.some(f => f.type === 'tactical')) {
      needs.push(CoachingObjective.TACTICAL_GUIDANCE);
    }
    
    // Mental coaching needs
    if (player.riskFactors.length > 0) {
      needs.push(CoachingObjective.MENTAL_COACHING);
    }
    
    // Team coordination needs
    if (context.gameState.processed.teamState.communication.coordination < 0.5) {
      needs.push(CoachingObjective.TEAM_COORDINATION);
    }
    
    return needs;
  }

  private analyzePlayerBehavior(player: PlayerGameState, memory: BaseMemoryEntry[]): string[] {
    const patterns: string[] = [];
    
    // Analyze recent behavior patterns from memory
    const recentBehavior = memory
      .filter(entry => entry.type === MemoryType.INTERACTION_HISTORY)
      .slice(-10); // Last 10 entries
    
    // Add behavioral analysis logic here
    if (player.observedBehaviors.includes('aggressive')) {
      patterns.push('aggressive_playstyle');
    }
    
    if (player.observedBehaviors.includes('passive')) {
      patterns.push('passive_playstyle');
    }
    
    return patterns;
  }

  private generateInterventionRecommendations(context: AIDecisionContext): any[] {
    const recommendations = [];
    const urgency = this.calculateUrgency(context.gameState);
    
    if (urgency === 'critical') {
      recommendations.push({
        type: 'immediate_tactical_advice',
        rationale: 'Critical situation requires immediate guidance',
        tools: ['Tool_GetGSIInfo', 'Tool_CallLLM', 'Tool_PiperTTS'],
        priority: InterventionPriority.IMMEDIATE
      });
    }
    
    return recommendations;
  }

  private isOnCooldown(ruleId: string, cooldownMs: number): boolean {
    const lastUsed = this.recentDecisions.get(ruleId);
    if (!lastUsed) return false;
    
    return (Date.now() - lastUsed.getTime()) < cooldownMs;
  }

  private prepareToolInput(toolName: string, decision: AIDecision | null, stepIndex: number): any {
    const baseInput = {
      gameState: decision?.context.gameState,
      memory: decision?.context.playerMemory,
      step: stepIndex,
      timeout: this.calculateOptimalTimeout(toolName),
      retryPolicy: this.getRetryPolicy(toolName),
      fallback: this.getFallbackTool(toolName),
      expectedOutput: this.getExpectedOutput(toolName)
    };

    // Tool-specific input preparation
    switch (toolName) {
      case 'Tool_GetGSIInfo':
        return {
          ...baseInput,
          requestedData: ['player', 'team', 'round', 'map'],
          includeHistory: true
        };

      case 'Tool_AnalyzePositioning':
        return {
          ...baseInput,
          playerPosition: decision?.context.gameState?.processed?.playerState?.position,
          teamPositions: [], // TeamGameState doesn't contain member positions
          mapData: decision?.context.gameState?.processed?.mapState,
          analysisType: 'tactical'
        };

      case 'Tool_CallLLM':
        return {
          ...baseInput,
          prompt: this.generateLLMPrompt(decision),
          maxTokens: 500,
          temperature: 0.7,
          context: decision?.context
        };

      case 'Tool_SuggestEconomyBuy':
        return {
          ...baseInput,
          playerMoney: decision?.context.gameState?.processed?.playerState?.money,
          teamMoney: decision?.context.gameState?.processed?.teamState?.economy?.totalMoney,
          // roundType not available in processed gameState
          equipment: decision?.context.gameState?.processed?.playerState?.weapons
        };

      case 'Tool_GetTrackerGGStats':
        return {
          ...baseInput,
          playerId: decision?.context.gameState?.processed?.playerState?.steamId,
          statsType: ['recent', 'overall'],
          includeComparison: true
        };

      case 'Tool_UpdatePlayerProfile':
        return {
          ...baseInput,
          profileData: this.extractProfileData(decision),
          updateType: 'performance'
        };

      case 'Tool_PiperTTS':
        return {
          ...baseInput,
          text: decision?.rationale || '',
          voice: 'default',
          speed: 1.0
        };

      case 'Tool_SummarizeConversation':
        return {
          ...baseInput,
          conversationHistory: decision?.context.playerMemory?.slice(-10) || [],
          summaryType: 'coaching'
        };

      default:
        return baseInput;
    }
  }

  private calculateOptimalTimeout(toolName: string): number {
    return this.toolTimeouts[toolName as ToolName] || 30000;
  }

  /**
   * Defines the retry policy for a given tool
   */
  private getRetryPolicy(toolName: string): { maxRetries: number; backoffStrategy: 'linear' | 'exponential' } {
    switch (toolName) {
      case 'Tool_GetGSIInfo':
        return { maxRetries: 3, backoffStrategy: 'linear' };
      case 'Tool_GetTrackerGGStats':
        return { maxRetries: 2, backoffStrategy: 'exponential' };
      default:
        return { maxRetries: 0, backoffStrategy: 'linear' };
    }
  }

  private getFallbackTool(toolName: string): string | undefined {
    return this.toolFallbacks[toolName as ToolName];
  }

  /**
   * Defines the expected output format or type for a given tool
   */
  private getExpectedOutput(toolName: string): string {
    return this.toolOutputs[toolName as ToolName] || 'No specific output format defined.';
  }

  /**
   * Estimates the total processing time for a tool chain
   */
  private estimateProcessingTime(toolChain: string[]): number {
    return toolChain.reduce((total, toolName) => total + this.calculateOptimalTimeout(toolName), 0);
  }

  /**
   * Calculates the complexity score for a tool chain
   */
  private calculateComplexity(toolChain: string[]): number {
    return toolChain.reduce((total, toolName) => {
      const complexity = this.toolComplexities[toolName as ToolName] || 1;
      return total + complexity;
    }, 0);
  }

  private assessRiskLevel(rule: DecisionRule, context: AIDecisionContext): 'low' | 'medium' | 'high' {
    if (rule.priority === InterventionPriority.IMMEDIATE) return 'high';
    if (context.gameState.processed.situationalFactors.some(f => f.severity === 'critical')) return 'high';
    if (rule.confidence < 0.7) return 'medium';
    return 'low';
  }

  private identifyParallelExecutionOpportunities(steps: ToolChainStep[]): void {
    // Identify steps that can run in parallel (no dependencies on each other)
    const parallelSteps = steps.filter((step, index) => {
      return index > 0 && !step.dependencies.some(dep => 
        steps.slice(0, index).some(prevStep => prevStep.stepId === dep)
      );
    });
    
    // Mark parallel steps (implementation depends on execution framework)
    parallelSteps.forEach(step => {
      (step as any).canRunInParallel = true;
    });
  }

  private findDecisionByFeedback(feedback: UserFeedback): AIDecision | null {
    // Search through recent decisions to find the one matching the feedback
    if (!feedback.decisionId) return null;

    // Check if we have the decision in our recent decisions cache
    const decisionTimestamp = this.recentDecisions.get(feedback.decisionId);
    if (!decisionTimestamp) return null;

    // Reconstruct basic decision info from the feedback and stored data
    const ruleId = this.extractRuleIdFromDecision({ id: feedback.decisionId } as AIDecision);
    const rule = this.decisionRules.get(ruleId);
    
    if (!rule) return null;

    // Create a minimal decision object for learning purposes
    return {
      id: feedback.decisionId,
      type: rule.name,
      priority: rule.priority,
      confidence: rule.confidence,
      rationale: rule.description,
      toolChain: this.generateToolChain(rule.toolChain),
      context: {} as any, // Context would need to be stored separately for full reconstruction
      metadata: {
        complexity: this.calculateComplexity(rule.toolChain),
        executionTime: this.estimateProcessingTime(rule.toolChain),
        expectedOutcome: 'Decision outcome based on rule: ' + rule.name,
        riskLevel: 'medium'
      }
    };
  }

  private extractRuleIdFromDecision(decision: AIDecision): string {
    // Extract rule ID from decision ID pattern
    const match = decision.id.match(/decision_(.+)_\d+/);
    return match ? match[1] : '';
  }

  private updateMovingAverage(current: number, newValue: number, learningRate: number): number {
    return current * (1 - learningRate) + newValue * learningRate;
  }

  private calculateConfidenceAdjustment(feedback: UserFeedback): number {
    const baseAdjustment = (feedback.rating - 3) * 0.02; // -0.04 to +0.04
    const helpfulnessMultiplier = feedback.helpful ? 1 : 0.5;
    const relevanceMultiplier = feedback.relevance;
    
    return baseAdjustment * helpfulnessMultiplier * relevanceMultiplier;
  }

  private calculatePerformanceAdjustment(outcome: ExecutionOutcome): number {
    const baseAdjustment = outcome.success ? 0.1 : -0.1;
    const impactFactor = outcome.impact;
    const responseFactor = outcome.playerResponse === 'positive' ? 0.2 :
      outcome.playerResponse === 'neutral' ? 0 : -0.2;

    return baseAdjustment + (impactFactor * 0.2) + responseFactor;
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  /**
   * Get learning statistics
   */
  getLearningStats(): Map<string, DecisionLearning> {
    return new Map(this.learningData);
  }

  /**
   * Reset learning data (for testing or reset scenarios)
   */
  resetLearning(): void {
    this.learningData.clear();
    this.recentDecisions.clear();
    this.initializeDecisionRules();
    this.emit('learning-reset');
  }

  /**
   * Get decision rules
   */
  getDecisionRules(): Map<string, DecisionRule> {
    return new Map(this.decisionRules);
  }

  async generateDecisions(context: AIDecisionContext): Promise<AIDecision[]> {
    const decisions: AIDecision[] = [];

    // Check positioning
    if (this.shouldAnalyzePositioning(context)) {
      const decision = await this.generatePositioningDecision(context);
      if (decision) decisions.push(decision);
    }

    // Check economy
    const phase = context.gameState.processed.phase;
    if (phase === 'freezetime' || phase === 'round_start') {
      const decision = await this.generateEconomyDecision(context);
      if (decision) decisions.push(decision);
    }

    // Check performance
    const player = context.gameState.processed.playerState;
    if (phase === 'round_end' || player.health <= 0) {
      const decision = await this.generatePerformanceDecision(context);
      if (decision) decisions.push(decision);
    }

    return decisions;
  }

  private shouldAnalyzePositioning(context: AIDecisionContext): boolean {
    const lastCheck = this.lastDecisionTimestamp.get('positioning') || 0;
    if (Date.now() - lastCheck < this.COOLDOWN_MS) return false;

    const player = context.gameState.processed.playerState;
    const gamePhase = context.gameState.processed.phase;

    // Check if player is in an active round
    if (gamePhase !== 'live' && gamePhase !== 'freezetime') {
      return false;
    }

    // Check player state
    const isActive = player.health > 0;
    const hasMovedRecently = this.hasRecentMovement(player.position);

    return isActive && hasMovedRecently;
  }

  private hasRecentMovement(position: { x: number; y: number; z: number }): boolean {
    // Implementation to check if position has changed significantly
    // This would typically compare with a previously stored position
    return true; // Simplified for now
  }

  // Fix the tool chain generation
  private generateToolChain(toolNames: string[]): ToolChainStep[] {
    return toolNames.map((toolName, index) => ({
      stepId: `step_${index}`,
      toolName,
      input: this.prepareToolInput(toolName, null, index),
      dependencies: index === 0 ? [] : [`step_${index - 1}`],
      timeout: this.calculateOptimalTimeout(toolName),
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'linear'
      },
      expectedOutput: this.getExpectedOutput(toolName)
    }));
  }

  private async generatePositioningDecision(context: AIDecisionContext): Promise<AIDecision> {
    const toolChain = this.generateToolChain(['Tool_AnalyzePositioning', 'Tool_CallLLM']);
    return Promise.resolve({
      id: `positioning_${Date.now()}`,
      type: 'positioning_analysis',
      priority: InterventionPriority.HIGH,
      confidence: 0.8,
      rationale: 'Analyzing player positioning and providing tactical advice',
      toolChain,
      context,
      metadata: {
        complexity: this.calculateComplexity(['Tool_AnalyzePositioning', 'Tool_CallLLM']),
        executionTime: 13000, // 5s + 8s from tool chain
        expectedOutcome: 'Improved player positioning and tactical awareness',
        riskLevel: 'medium'
      }
    });
  }

  private async generateEconomyDecision(context: AIDecisionContext): Promise<AIDecision> {
    const toolChain = this.generateToolChain(['Tool_SuggestEconomyBuy', 'Tool_CallLLM']);
    return Promise.resolve({
      id: `economy_${Date.now()}`,
      type: 'economy_advice',
      priority: InterventionPriority.HIGH,
      confidence: 0.85,
      rationale: 'Providing economy management and buy strategy advice',
      toolChain,
      context,
      metadata: {
        complexity: this.calculateComplexity(['Tool_SuggestEconomyBuy', 'Tool_CallLLM']),
        executionTime: 11000, // 3s + 8s from tool chain
        expectedOutcome: 'Optimized team economy and buy strategy',
        riskLevel: 'medium'
      }
    });
  }

  private async generatePerformanceDecision(context: AIDecisionContext): Promise<AIDecision> {
    const toolChain = this.generateToolChain(['Tool_GetTrackerGGStats', 'Tool_CallLLM']);
    return Promise.resolve({
      id: `performance_${Date.now()}`,
      type: 'performance_feedback',
      priority: InterventionPriority.MEDIUM,
      confidence: 0.75,
      rationale: 'Analyzing player performance and providing feedback',
      toolChain,
      context,
      metadata: {
        complexity: this.calculateComplexity(['Tool_GetTrackerGGStats', 'Tool_CallLLM']),
        executionTime: 18000, // 10s + 8s from tool chain
        expectedOutcome: 'Improved player performance through targeted feedback',
        riskLevel: 'low'
      }
    });
  }

  // Fix the array comparison method
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  private generateLLMPrompt(decision: AIDecision | null): string {
    if (!decision) return 'Analyze the current game state and provide coaching advice.';

    const context = decision.context;
    const gameState = context.gameState?.processed;
    const player = gameState?.playerState;
    const team = gameState?.teamState;

    let prompt = `You are an AI CS2 coach. Current situation:\n`;
    
    if (player) {
      prompt += `Player: Health ${player.health}, Money $${player.money}, `;
      prompt += `Position: ${player.position ? `(${player.position.x}, ${player.position.y})` : 'unknown'}\n`;
    }

    if (team) {
      prompt += `Team Score: ${team.score}\n`;
    }

    if (gameState?.phase) {
      prompt += `Game Phase: ${gameState.phase}\n`;
    }

    if (decision.rationale) {
        prompt += `Coaching Objective: ${decision.rationale}\n`;
      }

    prompt += `\nProvide specific, actionable coaching advice for this situation.`;
    
    return prompt;
  }

  private extractProfileData(decision: AIDecision | null): any {
    if (!decision) return {};

    const context = decision.context;
    const gameState = context.gameState?.processed;
    const player = gameState?.playerState;
    const team = gameState?.teamState;

    return {
      playerId: player?.steamId,
      currentPerformance: {
        kills: player?.statistics?.kills || 0,
        deaths: player?.statistics?.deaths || 0,
        assists: player?.statistics?.assists || 0,
        score: player?.statistics?.rating || 0,
        health: player?.health || 0,
        money: player?.money || 0
      },
      teamPerformance: {
        teamScore: team?.score || 0,
        playersAlive: 0, // TeamGameState doesn't contain player data
        totalPlayers: 0 // TeamGameState doesn't contain player data
      },
      gameContext: {
          phase: gameState?.phase,
          mapName: gameState?.mapState?.name
        },
      timestamp: new Date().toISOString(),
      decisionContext: {
        rationale: decision.rationale,
        priority: decision.priority,
        confidence: decision.confidence
      }
    };
  }
}