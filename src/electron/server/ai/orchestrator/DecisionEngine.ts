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
  DecisionContext,
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

/**
 * Decision rule for contextual analysis
 */
interface DecisionRule {
  id: string;
  name: string;
  contexts: GameContext[];
  conditions: (context: DecisionContext) => boolean;
  toolChain: string[];
  priority: InterventionPriority;
  confidence: number;
  description: string;
  cooldown?: number; // Minimum time between applications (ms)
}

/**
 * Learning data for decision optimization
 */
interface DecisionLearning {
  ruleId: string;
  successRate: number;
  averageUserRating: number;
  totalApplications: number;
  lastUsed: Date;
  adaptations: {
    timestamp: Date;
    feedback: UserFeedback;
    outcome: ExecutionOutcome;
    adjustment: string;
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

    this.initializeDecisionRules();
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
        adaptations: []
      });
    });

    this.emit('rules-initialized', { count: rules.length });
  }

  /**
   * Main analysis method - analyzes context and generates AI decisions
   */
  async analyzeContext(context: DecisionContext): Promise<AIDecision[]> {
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
      this.emit('analysis-error', { error: error.message });
      throw new Error(`Decision analysis failed: ${error.message}`);
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
    const optimizedSteps: ToolChainStep[] = [];
    let stepIndex = 0;

    for (const step of decision.toolChain) {
      const optimizedStep: ToolChainStep = {
        stepId: `${decision.id}_step_${stepIndex}`,
        toolName: step.toolName,
        input: this.prepareToolInput(step.toolName, decision, stepIndex),
        expectedOutput: step.expectedOutput,
        dependencies: stepIndex === 0 ? [] : [`${decision.id}_step_${stepIndex - 1}`],
        timeout: this.calculateOptimalTimeout(step.toolName),
        retryPolicy: {
          maxRetries: this.getRetryPolicy(step.toolName).maxRetries,
          backoffStrategy: this.getRetryPolicy(step.toolName).backoffStrategy
        },
        fallbackTool: this.getFallbackTool(step.toolName)
      };

      optimizedSteps.push(optimizedStep);
      stepIndex++;
    }

    // Add parallel execution opportunities where possible
    this.identifyParallelExecutionOpportunities(optimizedSteps);

    return optimizedSteps;
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
        timestamp: new Date(),
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

  // ===== Private Helper Methods =====

  /**
   * Perform deep analysis of the current context
   */
  private async performContextAnalysis(context: DecisionContext): Promise<ContextAnalysis> {
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
  private async applyDecisionRules(context: DecisionContext, analysis: ContextAnalysis): Promise<AIDecision[]> {
    const decisions: AIDecision[] = [];
    
    for (const [ruleId, rule] of this.decisionRules) {
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
  private async generateDecisionFromRule(rule: DecisionRule, context: DecisionContext, analysis: ContextAnalysis): Promise<AIDecision | null> {
    try {
      const learningData = this.learningData.get(rule.id);
      const adjustedConfidence = learningData ? 
        (rule.confidence * 0.7 + learningData.successRate * 0.3) : rule.confidence;
      
      if (adjustedConfidence < this.config.minConfidenceThreshold) return null;

      const decision: AIDecision = {
        id: `decision_${rule.id}_${Date.now()}`,
        priority: rule.priority,
        rationale: `${rule.description} - Context: ${analysis.gameContext}, Urgency: ${analysis.urgency}`,
        confidence: adjustedConfidence,
        toolChain: rule.toolChain.map((toolName, index) => ({
          stepId: `${rule.id}_step_${index}`,
          toolName,
          input: this.prepareToolInput(toolName, null, index),
          expectedOutput: this.getExpectedOutput(toolName),
          dependencies: index === 0 ? [] : [`${rule.id}_step_${index - 1}`],
          timeout: this.calculateOptimalTimeout(toolName),
          retryPolicy: this.getRetryPolicy(toolName),
          fallbackTool: this.getFallbackTool(toolName)
        })),
        expectedOutcome: `Execute ${rule.name} to address ${analysis.coachingNeeds.join(', ')}`,
        metadata: {
          processingTime: this.estimateProcessingTime(rule.toolChain),
          complexity: this.calculateComplexity(rule.toolChain),
          riskLevel: this.assessRiskLevel(rule, context)
        }
      };

      return decision;
    } catch (error) {
      this.emit('decision-generation-error', { ruleId: rule.id, error: error.message });
      return null;
    }
  }

  /**
   * Filter decisions based on viability criteria
   */
  private filterViableDecisions(decisions: AIDecision[]): AIDecision[] {
    return decisions.filter(decision => {
      // Confidence threshold
      if (decision.confidence < this.config.minConfidenceThreshold) return false;
      
      // Resource constraints check
      if (decision.metadata.processingTime > 30000) return false; // Max 30 seconds
      
      // Risk assessment
      if (decision.metadata.riskLevel === 'high' && decision.confidence < 0.8) return false;
      
      return true;
    });
  }

  // ===== Condition Check Methods =====

  private isCriticalPositioning(context: DecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    return player.health < 50 || 
           situationalFactors.some(factor => 
             factor.type === 'positional' && factor.severity === 'critical'
           );
  }

  private needsEconomyAdvice(context: DecisionContext): boolean {
    const economy = context.gameState.processed.economyState;
    const team = context.gameState.processed.teamState;
    
    return economy.roundType === 'eco' || 
           economy.roundType === 'force' ||
           team.economy.buyCapability !== 'full_buy';
  }

  private hasPerformanceInsights(context: DecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    
    // Check for significant performance events
    return player.statistics.rating < 0.5 || 
           player.statistics.deaths > player.statistics.kills + 2 ||
           player.riskFactors.length > 0;
  }

  private needsTacticalGuidance(context: DecisionContext): boolean {
    const situationalFactors = context.gameState.processed.situationalFactors;
    
    return situationalFactors.some(factor => 
      factor.type === 'tactical' && factor.actionRequired
    );
  }

  private needsMentalSupport(context: DecisionContext): boolean {
    const player = context.gameState.processed.playerState;
    const team = context.gameState.processed.teamState;
    
    // Check for psychological stress indicators
    return player.statistics.deaths > 5 ||
           team.score < (context.gameState.processed.mapState.round * 0.3) ||
           player.riskFactors.includes('tilt') ||
           player.riskFactors.includes('frustration');
  }

  private hasLearningOpportunity(context: DecisionContext): boolean {
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

  private identifyCoachingNeeds(context: DecisionContext): CoachingObjective[] {
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

  private generateInterventionRecommendations(context: DecisionContext): any[] {
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
    // Prepare context-specific input for each tool
    switch (toolName) {
      case 'Tool_GetGSIInfo':
        return { requestType: 'current_state' };
      
      case 'Tool_CallLLM':
        return {
          prompt: decision ? 
            `Analyze the following game situation and provide coaching advice: ${decision.rationale}` :
            'Provide general coaching guidance for the current game state',
          maxTokens: 150,
          temperature: 0.7
        };
      
      case 'Tool_PiperTTS':
        return {
          text: 'Coaching advice will be provided here',
          voice: 'en_US-ryan-medium',
          speed: 1.0
        };
      
      default:
        return {};
    }
  }

  private calculateOptimalTimeout(toolName: string): number {
    const timeouts = {
      'Tool_GetGSIInfo': 2000,
      'Tool_CallLLM': 15000,
      'Tool_PiperTTS': 8000,
      'Tool_GetTrackerGGStats': 5000,
      'Tool_UpdatePlayerProfile': 3000,
      'Tool_AnalyzePositioning': 10000,
      'Tool_SuggestEconomyBuy': 5000,
      'Tool_SummarizeConversation': 12000
    };
    
    return timeouts[toolName] || 10000;
  }

  private getRetryPolicy(toolName: string): { maxRetries: number; backoffStrategy: 'linear' | 'exponential' } {
    const highReliabilityTools = ['Tool_GetGSIInfo', 'Tool_UpdatePlayerProfile'];
    
    return {
      maxRetries: highReliabilityTools.includes(toolName) ? 3 : 2,
      backoffStrategy: 'exponential'
    };
  }

  private getFallbackTool(toolName: string): string | undefined {
    const fallbacks = {
      'Tool_CallLLM': 'Tool_GetGSIInfo',
      'Tool_PiperTTS': undefined, // No fallback for TTS
      'Tool_GetTrackerGGStats': 'Tool_GetGSIInfo'
    };
    
    return fallbacks[toolName];
  }

  private getExpectedOutput(toolName: string): string {
    const outputs = {
      'Tool_GetGSIInfo': 'Current game state data',
      'Tool_CallLLM': 'AI-generated coaching advice',
      'Tool_PiperTTS': 'Audio file for coaching feedback',
      'Tool_GetTrackerGGStats': 'Player statistics and performance data',
      'Tool_UpdatePlayerProfile': 'Updated player profile confirmation',
      'Tool_AnalyzePositioning': 'Positioning analysis and recommendations',
      'Tool_SuggestEconomyBuy': 'Economy and buy recommendations',
      'Tool_SummarizeConversation': 'Session summary and insights'
    };
    
    return outputs[toolName] || 'Tool execution result';
  }

  private estimateProcessingTime(toolChain: string[]): number {
    return toolChain.reduce((total, toolName) => {
      return total + this.calculateOptimalTimeout(toolName);
    }, 0);
  }

  private calculateComplexity(toolChain: string[]): number {
    const complexityScores = {
      'Tool_GetGSIInfo': 1,
      'Tool_CallLLM': 3,
      'Tool_PiperTTS': 2,
      'Tool_GetTrackerGGStats': 2,
      'Tool_UpdatePlayerProfile': 1,
      'Tool_AnalyzePositioning': 3,
      'Tool_SuggestEconomyBuy': 2,
      'Tool_SummarizeConversation': 3
    };
    
    const totalComplexity = toolChain.reduce((total, toolName) => {
      return total + (complexityScores[toolName] || 2);
    }, 0);
    
    return Math.min(10, totalComplexity);
  }

  private assessRiskLevel(rule: DecisionRule, context: DecisionContext): 'low' | 'medium' | 'high' {
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
    // This would need to be implemented based on how decisions are tracked
    // For now, return null as placeholder
    return null;
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
    let adjustment = 0;
    
    if (outcome.success) adjustment += 0.01;
    else adjustment -= 0.02;
    
    switch (outcome.playerResponse) {
      case 'positive': adjustment += 0.01; break;
      case 'negative': adjustment -= 0.02; break;
      case 'ignored': adjustment -= 0.005; break;
    }
    
    adjustment += outcome.measuredImpact.performance * 0.01;
    adjustment += outcome.measuredImpact.engagement * 0.005;
    
    return Math.max(-0.05, Math.min(0.05, adjustment));
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
} 