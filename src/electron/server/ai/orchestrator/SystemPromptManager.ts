/**
 * System Prompt Manager
 * 
 * This module manages AI system prompts and contextual information injection
 * for the coaching system. It provides consistent AI personality, adapts prompts
 * based on game context, and ensures proper contextual information flow
 * throughout the AI processing pipeline.
 */

import { EventEmitter } from 'events';
import {
  GameStateSnapshot,
  CoachingObjective,
  GameContext,
  InterventionPriority,
  PlayerGameState,
  TeamGameState,
  SituationalFactor
} from './OrchestratorArchitecture.js';
import { BaseMemoryEntry, MemoryType } from '../interfaces/MemoryService.js';
import { MemoryService } from '../memory/MemoryService.js';

/**
 * Coaching personality profiles
 */
export enum CoachingPersonality {
  SUPPORTIVE = 'supportive',       // Encouraging, positive reinforcement
  ANALYTICAL = 'analytical',       // Data-driven, technical focus
  DIRECT = 'direct',              // Straightforward, no-nonsense
  MENTOR = 'mentor',              // Teaching-focused, educational
  TACTICAL = 'tactical',          // Strategy-focused, competitive
  ADAPTIVE = 'adaptive'           // Changes based on player needs
}

/**
 * Context injection modes
 */
export enum ContextMode {
  MINIMAL = 'minimal',            // Basic game state only
  STANDARD = 'standard',          // Game state + recent history
  COMPREHENSIVE = 'comprehensive', // Full context with memory
  ADAPTIVE = 'adaptive'           // Dynamically adjusted
}

/**
 * Prompt template structure
 */
interface PromptTemplate {
  id: string;
  name: string;
  personality: CoachingPersonality;
  basePrompt: string;
  contextSections: {
    gameState: string;
    playerProfile: string;
    sessionHistory: string;
    objectives: string;
    constraints: string;
  };
  adaptationRules: {
    urgency: Record<string, string>;
    gameContext: Record<GameContext, string>;
    playerMood: Record<string, string>;
  };
  outputFormat: {
    style: string;
    constraints: string[];
    examples: string[];
  };
}

/**
 * Contextual information package
 */
interface ContextualInput {
  timestamp: Date;
  gameState: GameStateSnapshot;
  playerMemory: BaseMemoryEntry[];
  sessionSummary: {
    duration: number;
    keyEvents: string[];
    performanceMetrics: Record<string, number>;
    learningOpportunities: string[];
  };
  coachingObjectives: CoachingObjective[];
  playerPreferences: {
    communicationStyle: string;
    feedbackFrequency: string;
    focusAreas: string[];
    avoidTopics: string[];
  };
  dynamicContext: {
    recentPerformance: string;
    emotionalState: string;
    attentionLevel: string;
    receptiveness: number; // 0-1
  };
}

/**
 * Generated prompt package
 */
interface GeneratedPrompt {
  id: string;
  timestamp: Date;
  personality: CoachingPersonality;
  contextMode: ContextMode;
  systemPrompt: string;
  contextualInfo: string;
  outputInstructions: string;
  metadata: {
    gameContext: GameContext;
    urgency: string;
    adaptations: string[];
    characterCount: number;
    estimatedTokens: number;
  };
}

/**
 * System prompt manager implementation
 */
export class SystemPromptManager extends EventEmitter {
  private memoryService: MemoryService;
  private promptTemplates: Map<string, PromptTemplate>;
  private activePersonality: CoachingPersonality;
  private contextMode: ContextMode;
  private config: {
    maxPromptLength: number;
    enableAdaptation: boolean;
    personalityLearning: boolean;
    contextRefreshInterval: number;
    debugMode: boolean;
  };
  private promptHistory: GeneratedPrompt[];
  private personalityMetrics: Map<CoachingPersonality, {
    usageCount: number;
    successRate: number;
    averageRating: number;
    lastUsed: Date;
  }>;

  constructor(memoryService: MemoryService) {
    super();
    this.memoryService = memoryService;
    this.promptTemplates = new Map();
    this.activePersonality = CoachingPersonality.ADAPTIVE;
    this.contextMode = ContextMode.STANDARD;
    this.promptHistory = [];
    this.personalityMetrics = new Map();

    this.config = {
      maxPromptLength: 4000,
      enableAdaptation: true,
      personalityLearning: true,
      contextRefreshInterval: 30000, // 30 seconds
      debugMode: false
    };

    this.initializePromptTemplates();
    this.initializePersonalityMetrics();
  }

  /**
   * Initialize predefined prompt templates for different personalities
   */
  private initializePromptTemplates(): void {
    const templates: PromptTemplate[] = [
      {
        id: 'supportive_coach',
        name: 'Supportive Coach',
        personality: CoachingPersonality.SUPPORTIVE,
        basePrompt: `You are a supportive CS2 AI coach focused on positive reinforcement and encouragement. Your goal is to help players improve while maintaining their confidence and motivation.

Core Principles:
- Always maintain a positive, encouraging tone
- Focus on improvement opportunities rather than failures
- Celebrate small wins and progress
- Provide constructive feedback with empathy
- Build player confidence through recognition of strengths`,

        contextSections: {
          gameState: "Current game situation analysis with focus on opportunities for positive impact",
          playerProfile: "Player strengths, recent improvements, and preferred learning style",
          sessionHistory: "Recent achievements, progress made, and positive moments",
          objectives: "Growth-oriented goals with emphasis on personal development",
          constraints: "Maintain encouraging tone even when addressing mistakes"
        },

        adaptationRules: {
          urgency: {
            low: "Provide gentle guidance and encouragement",
            medium: "Offer supportive advice with clear action steps",
            high: "Give confident direction while maintaining positive tone",
            critical: "Provide calm, reassuring guidance for pressure situations"
          },
          gameContext: {
            [GameContext.ROUND_START]: "Encourage positive mindset and confidence for the round",
            [GameContext.MID_ROUND]: "Support decision-making with encouraging guidance",
            [GameContext.ROUND_END]: "Acknowledge efforts and highlight learning opportunities",
            [GameContext.CRITICAL_SITUATION]: "Provide calm, confidence-building support",
            [GameContext.LEARNING_OPPORTUNITY]: "Frame lessons in positive, growth-oriented language",
            [GameContext.ECONOMY_PHASE]: "Suggest smart buys and economic strategy.",
            [GameContext.TACTICAL_TIMEOUT]: "Focus on a key adjustment for the next round.",
            [GameContext.INTERMISSION]: "Review previous rounds and set goals for the next half.",
            [GameContext.MATCH_END]: "Summarize performance and key takeaways from the match."
          },
          playerMood: {
            frustrated: "Focus on reassurance and stress reduction",
            confident: "Reinforce positive momentum and build on success",
            neutral: "Provide balanced encouragement and guidance",
            discouraged: "Emphasize past successes and potential for improvement"
          }
        },

        outputFormat: {
          style: "Warm, encouraging, solution-focused",
          constraints: [
            "Always include positive elements",
            "Use 'we' language to build team connection",
            "Avoid harsh criticism or negative language",
            "Frame challenges as growth opportunities"
          ],
          examples: [
            "Great positioning there! Let's build on that awareness by...",
            "I can see you're improving your crosshair placement. Next, try...",
            "That round showed real progress. Here's how we can take it further..."
          ]
        }
      },

      {
        id: 'analytical_coach',
        name: 'Analytical Coach',
        personality: CoachingPersonality.ANALYTICAL,
        basePrompt: `You are an analytical CS2 AI coach focused on data-driven insights and technical improvement. Your approach is methodical, precise, and based on objective analysis of gameplay patterns.

Core Principles:
- Base all advice on observable data and statistics
- Provide specific, measurable improvement targets
- Analyze patterns and trends in gameplay
- Use technical terminology appropriately
- Focus on efficiency and optimization`,

        contextSections: {
          gameState: "Detailed statistical analysis of current performance metrics",
          playerProfile: "Historical performance data, trends, and statistical patterns",
          sessionHistory: "Performance metrics, accuracy statistics, and measurable improvements",
          objectives: "Data-driven goals with specific KPIs and measurable outcomes",
          constraints: "Maintain analytical objectivity while providing actionable insights"
        },

        adaptationRules: {
          urgency: {
            low: "Provide detailed analysis with multiple options",
            medium: "Focus on key metrics and primary optimization opportunities",
            high: "Highlight critical statistics and immediate adjustments needed",
            critical: "Provide clear, data-backed recommendations for immediate action"
          },
          gameContext: {
            [GameContext.ROUND_START]: "Analyze economy and strategic positioning data",
            [GameContext.MID_ROUND]: "Process real-time performance metrics for optimization",
            [GameContext.ROUND_END]: "Review round statistics and identify improvement patterns",
            [GameContext.CRITICAL_SITUATION]: "Analyze situational probabilities and optimal plays",
            [GameContext.LEARNING_OPPORTUNITY]: "Break down decision trees and outcome analysis",
            [GameContext.ECONOMY_PHASE]: "Analyze buy options based on team economy.",
            [GameContext.TACTICAL_TIMEOUT]: "Review statistics to suggest a tactical shift.",
            [GameContext.INTERMISSION]: "Provide a statistical summary of the first half.",
            [GameContext.MATCH_END]: "Deliver a final performance report with key stats."
          },
          playerMood: {
            frustrated: "Focus on objective data to reduce emotional decision-making",
            confident: "Provide advanced analytics to maintain high performance",
            neutral: "Present balanced statistical analysis with clear recommendations",
            discouraged: "Use positive trending data to demonstrate improvement"
          }
        },

        outputFormat: {
          style: "Precise, data-driven, technically detailed",
          constraints: [
            "Include specific statistics and percentages",
            "Reference objective performance metrics",
            "Provide quantifiable improvement targets",
            "Use technical CS2 terminology accurately"
          ],
          examples: [
            "Your ADR improved 15% this round. Focus on crosshair placement - 67% of your deaths were from off-angle positioning.",
            "Economy analysis: Save this round. Your team's $2,400 average puts you at 23% win probability with full buy.",
            "Positioning data shows 78% success rate when holding connector. Replicate this angle placement."
          ]
        }
      },

      {
        id: 'tactical_coach',
        name: 'Tactical Coach',
        personality: CoachingPersonality.TACTICAL,
        basePrompt: `You are a tactical CS2 AI coach focused on strategic gameplay, team coordination, and competitive optimization. Your expertise lies in advanced tactics, map control, and winning strategies.

Core Principles:
- Emphasize strategic thinking and tactical awareness
- Focus on team coordination and communication
- Analyze map control and positioning strategically
- Provide competitive-level insights and strategies
- Develop advanced game sense and decision-making`,

        contextSections: {
          gameState: "Strategic analysis of map control, team positioning, and tactical opportunities",
          playerProfile: "Tactical preferences, strategic understanding, and team role capabilities",
          sessionHistory: "Strategic decisions made, team coordination effectiveness, and tactical evolution",
          objectives: "Strategic improvement goals focused on tactical advancement and competitive growth",
          constraints: "Maintain competitive focus while ensuring accessibility of tactical concepts"
        },

        adaptationRules: {
          urgency: {
            low: "Discuss strategic concepts and long-term tactical development",
            medium: "Provide tactical adjustments and strategic positioning advice",
            high: "Give clear strategic direction and immediate tactical solutions",
            critical: "Deliver decisive tactical commands and strategic priority calls"
          },
          gameContext: {
            [GameContext.ROUND_START]: "Provide strategic round planning and tactical setup guidance",
            [GameContext.MID_ROUND]: "Analyze tactical opportunities and strategic positioning adjustments",
            [GameContext.ROUND_END]: "Review tactical decisions and strategic learning opportunities",
            [GameContext.CRITICAL_SITUATION]: "Provide advanced tactical solutions for complex scenarios",
            [GameContext.LEARNING_OPPORTUNITY]: "Explain advanced strategic concepts and tactical theory",
            [GameContext.ECONOMY_PHASE]: "Suggest tactical buys to counter the enemy's economy.",
            [GameContext.TACTICAL_TIMEOUT]: "Propose a new strategy for the upcoming rounds.",
            [GameContext.INTERMISSION]: "Outline a strategic plan for the second half.",
            [GameContext.MATCH_END]: "Provide a tactical summary of the match."
          },
          playerMood: {
            frustrated: "Focus on strategic foundation and tactical fundamentals",
            confident: "Introduce advanced tactical concepts and competitive strategies",
            neutral: "Provide balanced tactical guidance with strategic context",
            discouraged: "Emphasize tactical strengths and strategic potential"
          }
        },

        outputFormat: {
          style: "Strategic, competitive, tactically focused",
          constraints: [
            "Emphasize team coordination and strategic thinking",
            "Use competitive terminology and advanced concepts",
            "Focus on map control and tactical advantages",
            "Provide strategic reasoning for all recommendations"
          ],
          examples: [
            "Control mid first - it gives you 3 rotation options and splits their defense. Have your entry fragger take apartments while you support from connector.",
            "Their economy is broken. Force them to full-save by playing anti-eco positions. Stack A site, leave one connector for rotations.",
            "Execute the A-site take we practiced: smokes on CT, default on catwalk, prepare for the retake timing."
          ]
        }
      },

      {
        id: 'adaptive_coach',
        name: 'Adaptive Coach',
        personality: CoachingPersonality.ADAPTIVE,
        basePrompt: `You are an adaptive CS2 AI coach that dynamically adjusts your coaching style based on player needs, emotional state, and situational context. You seamlessly blend different approaches for optimal learning and performance.

Core Principles:
- Continuously assess and adapt to player needs
- Blend coaching styles based on context and effectiveness
- Maintain awareness of player emotional state and receptiveness
- Optimize communication for maximum impact and learning
- Evolve coaching approach based on player development`,

        contextSections: {
          gameState: "Comprehensive situation analysis with focus on optimal coaching approach",
          playerProfile: "Learning preferences, response patterns, and effectiveness of different coaching styles",
          sessionHistory: "Coaching interaction effectiveness, player responses, and adaptation patterns",
          objectives: "Flexible goals that adapt to player state and optimal learning opportunities",
          constraints: "Balance multiple coaching approaches while maintaining consistency and effectiveness"
        },

        adaptationRules: {
          urgency: {
            low: "Choose coaching style based on player learning state and receptiveness",
            medium: "Adapt approach to match situational needs and player confidence level",
            high: "Select most effective communication style for immediate player needs",
            critical: "Use proven effective approach for this player in high-pressure situations"
          },
          gameContext: {
            [GameContext.ROUND_START]: "Adapt approach based on player confidence and strategic needs",
            [GameContext.MID_ROUND]: "Choose coaching style that matches player attention and stress level",
            [GameContext.ROUND_END]: "Select reflection approach that maximizes learning and motivation",
            [GameContext.CRITICAL_SITUATION]: "Use player's preferred high-pressure communication style",
            [GameContext.LEARNING_OPPORTUNITY]: "Adapt teaching approach to player's optimal learning style",
            [GameContext.ECONOMY_PHASE]: "Adapt based on the economic situation.",
            [GameContext.TACTICAL_TIMEOUT]: "Adapt based on the tactical needs.",
            [GameContext.INTERMISSION]: "Adapt based on halftime summary.",
            [GameContext.MATCH_END]: "Adapt based on match results."
          },
          playerMood: {
            frustrated: "Switch to supportive approach with stress reduction focus",
            confident: "Use analytical or tactical approach to maintain momentum",
            neutral: "Assess optimal approach based on current learning opportunity",
            discouraged: "Blend supportive and tactical approaches for confidence building"
          }
        },

        outputFormat: {
          style: "Dynamically adapts - may be supportive, analytical, tactical, or direct as needed",
          constraints: [
            "Match communication style to player state and needs",
            "Maintain consistency within each interaction",
            "Signal style changes when appropriate",
            "Optimize for player learning and performance outcomes"
          ],
          examples: [
            "[Switching to supportive mode] I can see you're frustrated. Let's focus on what you did well that round and build from there...",
            "[Analytical approach] Based on your performance pattern, here's the specific adjustment that will have the biggest impact...",
            "[Tactical focus] The strategic opportunity here is clear - let me walk you through the tactical solution..."
          ]
        }
      }
    ];

    // Register all templates
    templates.forEach(template => {
      this.promptTemplates.set(template.id, template);
    });

    this.emit('templates-initialized', { count: templates.length });
  }

  /**
   * Initialize personality metrics tracking
   */
  private initializePersonalityMetrics(): void {
    Object.values(CoachingPersonality).forEach(personality => {
      this.personalityMetrics.set(personality, {
        usageCount: 0,
        successRate: 0.5,
        averageRating: 3.0,
        lastUsed: new Date(0)
      });
    });
  }

  /**
   * Generate system prompt with contextual information
   */
  async generatePrompt(
    contextualInput: ContextualInput,
    coachingObjectives: CoachingObjective[],
    options?: {
      forcePersonality?: CoachingPersonality;
      contextMode?: ContextMode;
      urgencyOverride?: string;
    }
  ): Promise<GeneratedPrompt> {
    const startTime = Date.now();

    try {
      this.ensureInitialized();

      // Determine personality and context mode
      const personality = options?.forcePersonality || await this.determineOptimalPersonality(contextualInput);
      const mode = options?.contextMode || this.contextMode;

      // Get the appropriate template
      const template = this.getTemplateForPersonality(personality);
      if (!template) {
        throw new Error(`No prompt template found for personality: ${personality}`);
      }

      // Build contextual information string
      const contextInfo = await this.buildContextualInfo(contextualInput, mode);

      // Generate adaptations based on context
      const adaptations = this.generateAdaptations(template, contextualInput, options);

      // Construct the final system prompt
      const systemPrompt = this.constructSystemPrompt(template, adaptations, contextInfo);

      // Generate output instructions
      const outputInstructions = this.generateOutputInstructions(template, contextualInput, coachingObjectives);

      const finalPrompt: GeneratedPrompt = {
        id: `prompt_${Date.now()}`,
        timestamp: new Date(),
        personality,
        contextMode: mode,
        systemPrompt,
        contextualInfo: contextInfo,
        outputInstructions,
        metadata: {
          gameContext: contextualInput.gameState.processed.context,
          urgency: this.calculateUrgency(contextualInput),
          adaptations: adaptations.map((a: any) => a.name),
          characterCount: systemPrompt.length + contextInfo.length + outputInstructions.length,
          estimatedTokens: Math.round((systemPrompt.length + contextInfo.length + outputInstructions.length) / 4)
        }
      };

      // Store and prune history
      this.promptHistory.push(finalPrompt);
      this.prunePromptHistory();

      // Update usage metrics
      this.updatePersonalityUsage(personality);

      if (this.config.debugMode) {
        console.log(`✅ Generated prompt '${finalPrompt.id}' in ${Date.now() - startTime}ms`);
      }

      this.emit('prompt-generated', finalPrompt);
      return finalPrompt;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error generating prompt: ${errorMessage}`);
      this.emit('error', new Error(`Prompt generation failed: ${errorMessage}`));
      throw error;
    }
  }

  /**
   * Update system prompt based on feedback
   */
  updateFromFeedback(promptId: string, feedback: {
    rating: number;
    effectiveness: number;
    appropriateness: number;
    suggestions?: string;
  }): void {
    const prompt = this.promptHistory.find(p => p.id === promptId);
    if (!prompt) return;

    // Update personality metrics
    const metrics = this.personalityMetrics.get(prompt.personality);
    if (metrics) {
      metrics.averageRating = (metrics.averageRating * 0.9) + (feedback.rating * 0.1);
      metrics.successRate = (metrics.successRate * 0.9) + (feedback.effectiveness * 0.1);
    }

    // Learn from feedback for future adaptations
    if (this.config.personalityLearning) {
      this.learnFromFeedback(prompt, feedback);
    }

    this.emit('feedback-processed', { promptId, personality: prompt.personality, feedback });
  }

  /**
   * Get current active personality
   */
  getActivePersonality(): CoachingPersonality {
    return this.activePersonality;
  }

  /**
   * Set active personality
   */
  setActivePersonality(personality: CoachingPersonality): void {
    this.activePersonality = personality;
    this.emit('personality-changed', { personality });
  }

  /**
   * Get contextual information for a game state
   */
  async getContextualInfo(gameState: GameStateSnapshot): Promise<string> {
    const contextualInput = await this.buildBasicContextualInput(gameState);
    return this.buildContextualInfo(contextualInput, this.contextMode);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);
  }

  // ===== Private Methods =====

  /**
   * Determine optimal personality based on context and learning
   */
  private async determineOptimalPersonality(
    contextualInput: ContextualInput
  ): Promise<CoachingPersonality> {
    if (this.activePersonality !== CoachingPersonality.ADAPTIVE) {
      return this.activePersonality;
    }

    // Analyze player state and context
    const playerState = contextualInput.dynamicContext;
    const gameContext = contextualInput.gameState.processed.context;
    const urgency = this.calculateUrgency(contextualInput);

    // Get personality effectiveness scores
    const personalityScores = new Map<CoachingPersonality, number>();

    Object.values(CoachingPersonality).forEach(personality => {
      if (personality === CoachingPersonality.ADAPTIVE) return;

      const metrics = this.personalityMetrics.get(personality);
      let score = metrics ? metrics.successRate : 0.5;

      // Context-based adjustments
      if (urgency === 'critical' && personality === CoachingPersonality.DIRECT) score += 0.2;
      if (playerState.emotionalState === 'frustrated' && personality === CoachingPersonality.SUPPORTIVE) score += 0.3;
      if (gameContext === GameContext.LEARNING_OPPORTUNITY && personality === CoachingPersonality.ANALYTICAL) score += 0.2;
      if (contextualInput.coachingObjectives.includes(CoachingObjective.TACTICAL_GUIDANCE) && 
          personality === CoachingPersonality.TACTICAL) score += 0.2;

      personalityScores.set(personality, score);
    });

    // Select highest scoring personality
    let bestPersonality = CoachingPersonality.SUPPORTIVE;
    let bestScore = 0;

    personalityScores.forEach((score, personality) => {
      if (score > bestScore) {
        bestScore = score;
        bestPersonality = personality;
      }
    });

    return bestPersonality;
  }

  /**
   * Get template for personality
   */
  private getTemplateForPersonality(personality: CoachingPersonality): PromptTemplate | null {
    // Map personalities to template IDs
    const templateMap = {
      [CoachingPersonality.SUPPORTIVE]: 'supportive_coach',
      [CoachingPersonality.ANALYTICAL]: 'analytical_coach',
      [CoachingPersonality.TACTICAL]: 'tactical_coach',
      [CoachingPersonality.ADAPTIVE]: 'adaptive_coach',
      [CoachingPersonality.DIRECT]: 'analytical_coach', // Fallback to analytical for now
      [CoachingPersonality.MENTOR]: 'supportive_coach'  // Fallback to supportive for now
    };

    const templateId = templateMap[personality];
    return this.promptTemplates.get(templateId) || null;
  }

  /**
   * Build contextual information string
   */
  private async buildContextualInfo(
    contextualInput: ContextualInput,
    mode: ContextMode
  ): Promise<string> {
    const sections: string[] = [];

    // Always include basic game state
    sections.push(this.formatGameStateContext(contextualInput.gameState));

    if (mode !== ContextMode.MINIMAL) {
      // Add player performance summary
      sections.push(this.formatPlayerContext(contextualInput));
      
      // Add session summary
      sections.push(this.formatSessionContext(contextualInput.sessionSummary));
    }

    if (mode === ContextMode.COMPREHENSIVE) {
      // Add detailed memory context
      sections.push(await this.formatMemoryContext(contextualInput.playerMemory));
      
      // Add dynamic context
      sections.push(this.formatDynamicContext(contextualInput.dynamicContext));
    }

    return sections.join('\n\n');
  }

  /**
   * Generate adaptations based on template and context
   */
  private generateAdaptations(
    template: PromptTemplate,
    contextualInput: ContextualInput,
    options?: any
  ): any[] {
    const adaptations = [];
    const urgency = options?.urgencyOverride || this.calculateUrgency(contextualInput);
    const gameContext = contextualInput.gameState.processed.context;
    const emotionalState = contextualInput.dynamicContext.emotionalState;

    // Urgency adaptation
    if (template.adaptationRules.urgency[urgency]) {
      adaptations.push({
        type: 'urgency',
        rule: urgency,
        adaptation: template.adaptationRules.urgency[urgency]
      });
    }

    // Game context adaptation
    if (template.adaptationRules.gameContext[gameContext]) {
      adaptations.push({
        type: 'gameContext',
        rule: gameContext,
        adaptation: template.adaptationRules.gameContext[gameContext]
      });
    }

    // Player mood adaptation
    if (template.adaptationRules.playerMood[emotionalState]) {
      adaptations.push({
        type: 'playerMood',
        rule: emotionalState,
        adaptation: template.adaptationRules.playerMood[emotionalState]
      });
    }

    return adaptations;
  }

  /**
   * Construct final system prompt
   */
  private constructSystemPrompt(
    template: PromptTemplate,
    adaptations: any[],
    contextInfo: string
  ): string {
    let prompt = template.basePrompt;

    // Add adaptations
    if (adaptations.length > 0) {
      prompt += '\n\nContextual Adaptations:\n';
      adaptations.forEach(adaptation => {
        prompt += `- ${adaptation.type}: ${adaptation.adaptation}\n`;
      });
    }

    // Add context
    if (contextInfo && contextInfo.length > 0) {
      prompt += '\n\nCurrent Context:\n' + contextInfo;
    }

    // Ensure within length limits
    if (prompt.length > this.config.maxPromptLength) {
      prompt = this.truncatePrompt(prompt, this.config.maxPromptLength);
    }

    return prompt;
  }

  /**
   * Generate output instructions
   */
  private generateOutputInstructions(
    template: PromptTemplate,
    contextualInput: ContextualInput,
    objectives: CoachingObjective[]
  ): string {
    const instructions = [];

    // Base style instructions
    instructions.push(`Communication Style: ${template.outputFormat.style}`);

    // Constraints
    if (template.outputFormat.constraints.length > 0) {
      instructions.push('\nConstraints:');
      template.outputFormat.constraints.forEach(constraint => {
        instructions.push(`- ${constraint}`);
      });
    }

    // Objectives-specific instructions
    if (objectives.length > 0) {
      instructions.push(`\nFocus Areas: ${objectives.join(', ')}`);
    }

    // Timing and urgency
    const urgency = this.calculateUrgency(contextualInput);
    instructions.push(`\nResponse Urgency: ${urgency}`);
    instructions.push(`Recommended Length: ${this.getRecommendedResponseLength(urgency)}`);

    return instructions.join('\n');
  }

  /**
   * Format game state context
   */
  private formatGameStateContext(gameState: GameStateSnapshot): string {
    const player = gameState.processed.playerState;
    const team = gameState.processed.teamState;
    const map = gameState.processed.mapState;

    return `Game State:
- Map: ${map.name}, Round: ${map.round}
- Phase: ${gameState.processed.phase}
- Player: ${player.health}HP, $${player.money}, ${player.weapons.map(w => w.name).join(', ')}
- Team: ${team.side}, Score: ${team.score}, Economy: ${team.economy.buyCapability}
- Context: ${gameState.processed.context}`;
  }

  /**
   * Format player context
   */
  private formatPlayerContext(contextualInput: ContextualInput): string {
    const player = contextualInput.gameState.processed.playerState;
    const dynamic = contextualInput.dynamicContext;

    return `Player Status:
- Performance: K/D: ${player.statistics.kills}/${player.statistics.deaths}, ADR: ${player.statistics.adr}
- Emotional State: ${dynamic.emotionalState}
- Attention Level: ${dynamic.attentionLevel}
- Receptiveness: ${Math.round(dynamic.receptiveness * 100)}%`;
  }

  /**
   * Format session context
   */
  private formatSessionContext(sessionSummary: any): string {
    return `Session Summary:
- Duration: ${Math.round(sessionSummary.duration / 60000)} minutes
- Key Events: ${sessionSummary.keyEvents.slice(0, 3).join(', ')}
- Learning Opportunities: ${sessionSummary.learningOpportunities.length}`;
  }

  /**
   * Format memory context
   */
  private async formatMemoryContext(playerMemory: BaseMemoryEntry[]): Promise<string> {
    if (!playerMemory || playerMemory.length === 0) {
      return "No relevant memories found.";
    }

    const formattedMemories = playerMemory.slice(0, 5).map(memory => {
      if (!memory.content) return null;
      return `- ${memory.type} (${memory.importance}): ${memory.content.substring(0, 100)}...`;
    }).filter(Boolean);

    return `
### Relevant Memories
${formattedMemories.join('\n')}
    `.trim();
  }

  /**
   * Format dynamic context
   */
  private formatDynamicContext(dynamicContext: any): string {
    return `Player appears to be ${dynamicContext.emotionalState} and has an attention level of ${dynamicContext.attentionLevel}.`;
  }

  /**
   * Calculate urgency level
   */
  private calculateUrgency(contextualInput: ContextualInput): string {
    const { gameState } = contextualInput;
    if (gameState.processed.situationalFactors.some(f => f.severity === 'critical')) {
      return 'critical';
    }
    if (gameState.processed.context === GameContext.CRITICAL_SITUATION) {
      return 'high';
    }
    if (gameState.processed.playerState.health < 30) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Get recommended response length based on urgency
   */
  private getRecommendedResponseLength(urgency: string): string {
    type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
    const lengths: Record<UrgencyLevel, string> = {
      low: "brief and concise",
      medium: "moderately detailed",
      high: "direct and to the point",
      critical: "extremely brief and actionable"
    };
    return lengths[urgency as UrgencyLevel] || "a standard length";
  }

  /**
   * Truncate prompt to fit within limits
   */
  private truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) return prompt;

    // Try to truncate at paragraph boundaries
    const paragraphs = prompt.split('\n\n');
    let truncated = '';
    
    for (const paragraph of paragraphs) {
      if (truncated.length + paragraph.length + 2 <= maxLength) {
        truncated += paragraph + '\n\n';
      } else {
        break;
      }
    }

    return truncated.trim() + '\n\n[Context truncated to fit limits]';
  }

  /**
   * Build basic contextual input from game state
   */
  private async buildBasicContextualInput(gameState: GameStateSnapshot): Promise<ContextualInput> {
    // This would be populated from various sources in a real implementation
    return {
      timestamp: new Date(),
      gameState,
      playerMemory: [],
      sessionSummary: {
        duration: 600000, // 10 minutes
        keyEvents: [],
        performanceMetrics: {},
        learningOpportunities: []
      },
      coachingObjectives: [],
      playerPreferences: {
        communicationStyle: 'balanced',
        feedbackFrequency: 'moderate',
        focusAreas: [],
        avoidTopics: []
      },
      dynamicContext: {
        recentPerformance: 'stable',
        emotionalState: 'neutral',
        attentionLevel: 'focused',
        receptiveness: 0.7
      }
    };
  }

  /**
   * Update personality usage metrics
   */
  private updatePersonalityUsage(personality: CoachingPersonality): void {
    const metrics = this.personalityMetrics.get(personality);
    if (metrics) {
      metrics.usageCount++;
      metrics.lastUsed = new Date();
    }
  }

  /**
   * Learn from feedback
   */
  private learnFromFeedback(prompt: GeneratedPrompt, feedback: any): void {
    // Implementation for learning from feedback would go here
    // This could update template effectiveness, adaptation rules, etc.
    this.emit('learning-update', { promptId: prompt.id, feedback });
  }

  /**
   * Prune prompt history
   */
  private prunePromptHistory(): void {
    const maxHistory = 100;
    if (this.promptHistory.length > maxHistory) {
      this.promptHistory = this.promptHistory.slice(-maxHistory);
    }
  }

  /**
   * Get personality metrics
   */
  getPersonalityMetrics(): Map<CoachingPersonality, any> {
    return new Map(this.personalityMetrics);
  }

  /**
   * Get prompt history
   */
  getPromptHistory(limit?: number): GeneratedPrompt[] {
    const history = [...this.promptHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  private ensureInitialized(): void {
    if (!this.memoryService || !this.promptTemplates || !this.activePersonality || !this.contextMode || !this.promptHistory || !this.personalityMetrics || !this.config) {
      throw new Error('SystemPromptManager is not fully initialized');
    }
  }
} 