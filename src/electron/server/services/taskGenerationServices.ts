/**
 * Task Generation Service
 * 
 * Implements the dynamic task generation algorithm that creates personalized
 * in-game tasks based on player profiles, game context, and AI insights.
 */

import { randomUUID } from "crypto";
import { EventEmitter } from 'events';
import db from "../../database/database.js";
import { MemoryService } from "../ai/memory/MemoryService.js";
import { PlayerProfileMemory, MemoryType } from "../ai/interfaces/MemoryService.js";

// ===== Core Task Types and Interfaces =====

export interface TaskGenerationRule {
  id: string;
  condition: (playerData: PlayerPersonalizationData, gameContext: TaskContext) => boolean;
  action: (taskType: TaskType, playerData: PlayerPersonalizationData) => void;
  priority: number;
}

export interface GameEvent {
  type: string;
  playerId: string;
  timestamp: Date;
  data: Record<string, any>;
  roundNumber?: number;
  mapName?: string;
  teamSide?: 'CT' | 'T';
}

export interface TaskProgressUpdate {
  taskId: string;
  previousProgress: number;
  newProgress: number;
  delta: number;
  completed: boolean;
  rewardEarned?: number;
  timestamp: Date;
}

export interface TaskGenerationStrategy {
  recommendedTaskCount: number;
  difficultyAdjustment: number;
  priorityCategories: TaskCategory[];
  adaptiveParameters: Record<string, any>;
}

export interface TaskType {
  id: string;
  name: string;
  category: TaskCategory;
  description: string;
  difficulty: DifficultyLevel;
  parameters: TaskParameter[];
  completionCriteria: CompletionCriteria;
  rewardConfig: RewardConfiguration;
}

export enum TaskCategory {
  COMBAT = 'combat',
  UTILITY = 'utility', 
  ECONOMY = 'economy',
  OBJECTIVE = 'objective',
  SUPPORT = 'support'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate', 
  ADVANCED = 'advanced',
  EXPERT = 'expert',
  ELITE = 'elite'
}

export interface TaskParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array';
  description: string;
  min?: number;
  max?: number;
  options?: any[];
  required: boolean;
}

export interface CompletionCriteria {
  type: 'count' | 'percentage' | 'time' | 'sequence' | 'combination';
  target: number;
  timeLimit?: number; // in seconds
  conditions?: Record<string, any>;
}

export interface RewardConfiguration {
  baseXP: number;
  difficultyMultiplier: number;
  bonusConditions?: Array<{
    condition: string;
    multiplier: number;
  }>;
}

export interface GeneratedTask {
  id: string;
  playerId: string;
  taskTypeId: string;
  title: string;
  description: string;
  parameters: Record<string, any>;
  completionCriteria: CompletionCriteria;
  difficulty: DifficultyLevel;
  expectedReward: number;
  status: TaskStatus;
  createdAt: Date;
  expiresAt?: Date;
  progress: TaskProgress;
  context: TaskContext;
}

export enum TaskStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export interface TaskProgress {
  current: number;
  target: number;
  percentage: number;
  lastUpdated: Date;
  checkpoints?: Array<{
    value: number;
    timestamp: Date;
    description?: string;
  }>;
}

export interface TaskContext {
  gameMode?: string;
  mapName?: string;
  teamSide?: 'CT' | 'T';
  roundNumber?: number;
  economicState?: string;
  teamComposition?: string[];
  situationalFactors?: string[];
}

export interface PlayerPersonalizationData {
  steamId: string;
  skillLevel: Record<string, number>; // 0-10 scale
  preferences: {
    taskTypes: TaskCategory[];
    difficulty: DifficultyLevel;
    frequency: 'low' | 'medium' | 'high';
    focusAreas: string[];
  };
  weaknesses: string[];
  strengths: string[];
  recentPerformance: {
    averageScore: number;
    consistency: number;
    improvementAreas: string[];
  };
  motivationalFactors: string[];
}

// ===== Task Generation Algorithm Implementation =====

export class TaskGenerationService extends EventEmitter {
  private memoryService: MemoryService;
  private taskTypes: Map<string, TaskType> = new Map();
  private activeTasksCache: Map<string, GeneratedTask[]> = new Map();
  private generationRules: TaskGenerationRule[] = [];
  
  constructor(memoryService: MemoryService) {
    super();
    this.memoryService = memoryService;
    this.initializeTaskTypes();
    this.initializeGenerationRules();
  }

  // ===== Core Task Generation Logic =====

  /**
   * Generate personalized tasks for a player based on their profile and game context
   */
  async generateTasksForPlayer(
    steamId: string, 
    gameContext: TaskContext,
    options: {
      maxTasks?: number;
      forceRefresh?: boolean;
      specificCategories?: TaskCategory[];
    } = {}
  ): Promise<GeneratedTask[]> {
    try {
      console.log(`🎯 Generating tasks for player ${steamId}`);
      
      // 1. Get player personalization data
      const playerData = await this.getPlayerPersonalizationData(steamId);
      if (!playerData) {
        console.warn(`⚠️ No player data found for ${steamId}`);
        return [];
      }

      // 2. Analyze current context and determine task selection strategy
      const strategy = this.determineGenerationStrategy(playerData, gameContext);
      
      // 3. Select appropriate task types based on profile and context
      const candidateTaskTypes = this.selectCandidateTaskTypes(playerData, gameContext, options);
      
      // 4. Generate and personalize tasks
      const generatedTasks: GeneratedTask[] = [];
      const maxTasks = options.maxTasks || strategy.recommendedTaskCount;
      
      for (let i = 0; i < maxTasks && candidateTaskTypes.length > 0; i++) {
        const taskType = this.selectOptimalTaskType(candidateTaskTypes, playerData, generatedTasks);
        if (!taskType) break;
        
        const personalizedTask = await this.personalizeTask(taskType, playerData, gameContext);
        if (personalizedTask) {
          generatedTasks.push(personalizedTask);
          // Remove used task type to ensure variety
          candidateTaskTypes.splice(candidateTaskTypes.indexOf(taskType), 1);
        }
      }

      // 5. Store tasks and update cache
      await this.storeGeneratedTasks(steamId, generatedTasks);
      this.activeTasksCache.set(steamId, generatedTasks);

      console.log(`✅ Generated ${generatedTasks.length} tasks for player ${steamId}`);
      this.emit('tasksGenerated', { steamId, tasks: generatedTasks });
      
      return generatedTasks;
    } catch (error) {
      console.error('❌ Error generating tasks for player:', error);
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Update task progress based on game events
   */
  async updateTaskProgress(
    steamId: string,
    gameEvent: GameEvent
  ): Promise<TaskProgressUpdate[]> {
    try {
      const activeTasks = await this.getActiveTasksForPlayer(steamId);
      const updates: TaskProgressUpdate[] = [];

      for (const task of activeTasks) {
        const progressUpdate = this.calculateProgressUpdate(task, gameEvent);
        if (progressUpdate) {
          await this.applyProgressUpdate(task.id, progressUpdate);
          updates.push(progressUpdate);

          // Check for task completion
          if (progressUpdate.completed) {
            await this.completeTask(task.id);
            this.emit('taskCompleted', { steamId, task, reward: progressUpdate.rewardEarned });
          }
        }
      }

      return updates;
    } catch (error) {
      console.error('❌ Error updating task progress:', error);
      this.emit('error', error);
      return [];
    }
  }

  // ===== Player Personalization Data Management =====

  private async getPlayerPersonalizationData(steamId: string): Promise<PlayerPersonalizationData | null> {
    try {
      // Get player profile from memory service
      const playerProfile = await this.memoryService.getPlayerProfile(steamId);
      if (!playerProfile) {
        console.log(`📝 Creating new player profile for ${steamId}`);
        return this.createDefaultPlayerData(steamId);
      }

      // Convert player profile to personalization data
      return this.convertProfileToPersonalizationData(playerProfile);
    } catch (error) {
      console.error('❌ Error getting player personalization data:', error);
      return null;
    }
  }

  private convertProfileToPersonalizationData(profile: PlayerProfileMemory): PlayerPersonalizationData {
    const data = profile.data;
    
    return {
      steamId: data.steamId,
      skillLevel: {
        aim: data.playingStyle.aggression * 10,
        movement: data.playingStyle.adaptability * 10,
        teamwork: data.playingStyle.teamwork * 10,
        consistency: data.playingStyle.consistency * 10,
        gameKnowledge: 5 // Default value, can be enhanced
      },
      preferences: {
        taskTypes: this.mapRolesToTaskCategories(data.playingStyle.preferredRoles),
        difficulty: this.determineDifficultyPreference(data),
        frequency: 'medium',
        focusAreas: data.improvementGoals.map(goal => goal.goal)
      },
      weaknesses: data.weaknesses.map(w => w.description),
      strengths: data.strengths.map(s => s.description),
      recentPerformance: {
        averageScore: 5.0, // Default, should be calculated from recent matches
        consistency: data.playingStyle.consistency,
        improvementAreas: data.weaknesses.map(w => w.category)
      },
      motivationalFactors: data.mentalState.motivationFactors
    };
  }

  private createDefaultPlayerData(steamId: string): PlayerPersonalizationData {
    return {
      steamId,
      skillLevel: {
        aim: 5,
        movement: 5, 
        teamwork: 5,
        consistency: 5,
        gameKnowledge: 5
      },
      preferences: {
        taskTypes: [TaskCategory.COMBAT, TaskCategory.OBJECTIVE],
        difficulty: DifficultyLevel.INTERMEDIATE,
        frequency: 'medium',
        focusAreas: ['aim', 'positioning']
      },
      weaknesses: [],
      strengths: [],
      recentPerformance: {
        averageScore: 5.0,
        consistency: 0.5,
        improvementAreas: []
      },
      motivationalFactors: ['improvement', 'competition']
    };
  }

  // ===== Task Type Management =====

  private initializeTaskTypes(): void {
    // Combat Tasks
    this.registerTaskType({
      id: 'combat_kills',
      name: 'Combat Eliminations',
      category: TaskCategory.COMBAT,
      description: 'Eliminate enemies in combat situations',
      difficulty: DifficultyLevel.INTERMEDIATE,
      parameters: [
        { name: 'killCount', type: 'number', description: 'Number of kills required', min: 1, max: 10, required: true },
        { name: 'weaponType', type: 'string', description: 'Specific weapon type', options: ['any', 'rifle', 'pistol', 'awp'], required: false },
        { name: 'roundLimit', type: 'number', description: 'Complete within X rounds', min: 1, max: 30, required: false }
      ],
      completionCriteria: {
        type: 'count',
        target: 0 // Will be set based on parameters
      },
      rewardConfig: {
        baseXP: 50,
        difficultyMultiplier: 1.0
      }
    });

    this.registerTaskType({
      id: 'combat_headshots',
      name: 'Precision Headshots',
      category: TaskCategory.COMBAT,
      description: 'Achieve headshot eliminations',
      difficulty: DifficultyLevel.ADVANCED,
      parameters: [
        { name: 'headshotCount', type: 'number', description: 'Number of headshots required', min: 1, max: 5, required: true },
        { name: 'weaponType', type: 'string', description: 'Weapon category', options: ['rifle', 'pistol'], required: false }
      ],
      completionCriteria: {
        type: 'count',
        target: 0
      },
      rewardConfig: {
        baseXP: 75,
        difficultyMultiplier: 1.5
      }
    });

    // Utility Tasks
    this.registerTaskType({
      id: 'utility_flash_assists',
      name: 'Flash Assists',
      category: TaskCategory.UTILITY,
      description: 'Help teammates with flashbang assists',
      difficulty: DifficultyLevel.INTERMEDIATE,
      parameters: [
        { name: 'assistCount', type: 'number', description: 'Number of flash assists', min: 1, max: 5, required: true }
      ],
      completionCriteria: {
        type: 'count',
        target: 0
      },
      rewardConfig: {
        baseXP: 40,
        difficultyMultiplier: 1.2
      }
    });

    // Economy Tasks
    this.registerTaskType({
      id: 'economy_save_success',
      name: 'Economic Discipline',
      category: TaskCategory.ECONOMY,
      description: 'Successfully save equipment in eco rounds',
      difficulty: DifficultyLevel.INTERMEDIATE,
      parameters: [
        { name: 'saveCount', type: 'number', description: 'Number of successful saves', min: 1, max: 3, required: true }
      ],
      completionCriteria: {
        type: 'count',
        target: 0
      },
      rewardConfig: {
        baseXP: 35,
        difficultyMultiplier: 1.1
      }
    });

    // Objective Tasks
    this.registerTaskType({
      id: 'objective_bomb_plants',
      name: 'Bomb Site Control',
      category: TaskCategory.OBJECTIVE,
      description: 'Plant the bomb successfully',
      difficulty: DifficultyLevel.INTERMEDIATE,
      parameters: [
        { name: 'plantCount', type: 'number', description: 'Number of bomb plants', min: 1, max: 3, required: true },
        { name: 'specificSite', type: 'string', description: 'Target specific site', options: ['any', 'A', 'B'], required: false }
      ],
      completionCriteria: {
        type: 'count',
        target: 0
      },
      rewardConfig: {
        baseXP: 60,
        difficultyMultiplier: 1.3
      }
    });
  }

  private registerTaskType(taskType: TaskType): void {
    this.taskTypes.set(taskType.id, taskType);
  }

  // ===== Task Selection and Personalization =====

  private determineGenerationStrategy(
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): TaskGenerationStrategy {
    const strategy: TaskGenerationStrategy = {
      recommendedTaskCount: 2,
      difficultyAdjustment: 0,
      priorityCategories: [],
      adaptiveParameters: {}
    };

    // Adjust task count based on player preferences
    switch (playerData.preferences.frequency) {
      case 'low':
        strategy.recommendedTaskCount = 1;
        break;
      case 'high':
        strategy.recommendedTaskCount = 3;
        break;
      default:
        strategy.recommendedTaskCount = 2;
    }

    // Adjust difficulty based on recent performance
    if (playerData.recentPerformance.averageScore > 7) {
      strategy.difficultyAdjustment = 1; // Increase difficulty
    } else if (playerData.recentPerformance.averageScore < 4) {
      strategy.difficultyAdjustment = -1; // Decrease difficulty
    }

    // Set priority categories based on weaknesses and game context
    strategy.priorityCategories = this.determinePriorityCategories(playerData, gameContext);

    return strategy;
  }

  private selectCandidateTaskTypes(
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext,
    options: any
  ): TaskType[] {
    const candidates: TaskType[] = [];
    
    for (const taskType of this.taskTypes.values()) {
      if (this.isTaskTypeApplicable(taskType, playerData, gameContext, options)) {
        candidates.push(taskType);
      }
    }

    // Sort by relevance and priority
    return candidates.sort((a, b) => 
      this.calculateTaskTypeScore(b, playerData, gameContext) - 
      this.calculateTaskTypeScore(a, playerData, gameContext)
    );
  }

  private async personalizeTask(
    taskType: TaskType,
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): Promise<GeneratedTask | null> {
    try {
      const personalizedParameters = this.personalizeTaskParameters(taskType, playerData, gameContext);
      const adjustedDifficulty = this.adjustTaskDifficulty(taskType.difficulty, playerData);
      const expectedReward = this.calculateExpectedReward(taskType, adjustedDifficulty, personalizedParameters);

      const task: GeneratedTask = {
        id: randomUUID(),
        playerId: playerData.steamId,
        taskTypeId: taskType.id,
        title: this.generateTaskTitle(taskType, personalizedParameters),
        description: this.generateTaskDescription(taskType, personalizedParameters),
        parameters: personalizedParameters,
        completionCriteria: {
          ...taskType.completionCriteria,
          target: personalizedParameters[taskType.parameters[0].name] || taskType.completionCriteria.target
        },
        difficulty: adjustedDifficulty,
        expectedReward,
        status: TaskStatus.ACTIVE,
        createdAt: new Date(),
        expiresAt: this.calculateTaskExpiration(taskType, gameContext),
        progress: {
          current: 0,
          target: personalizedParameters[taskType.parameters[0].name] || 1,
          percentage: 0,
          lastUpdated: new Date()
        },
        context: gameContext
      };

      return task;
    } catch (error) {
      console.error('❌ Error personalizing task:', error);
      return null;
    }
  }

  // ===== Helper Methods =====

  private mapRolesToTaskCategories(roles: string[]): TaskCategory[] {
    const categoryMap: Record<string, TaskCategory> = {
      'entry': TaskCategory.COMBAT,
      'support': TaskCategory.SUPPORT,
      'awp': TaskCategory.COMBAT,
      'igl': TaskCategory.OBJECTIVE,
      'lurker': TaskCategory.COMBAT
    };

    return roles.map(role => categoryMap[role] || TaskCategory.COMBAT);
  }

  private determineDifficultyPreference(data: any): DifficultyLevel {
    const avgSkill = (data.playingStyle.aggression + data.playingStyle.teamwork + 
                     data.playingStyle.adaptability + data.playingStyle.consistency) / 4;
    
    if (avgSkill < 0.3) return DifficultyLevel.BEGINNER;
    if (avgSkill < 0.5) return DifficultyLevel.INTERMEDIATE;
    if (avgSkill < 0.7) return DifficultyLevel.ADVANCED;
    if (avgSkill < 0.9) return DifficultyLevel.EXPERT;
    return DifficultyLevel.ELITE;
  }

  // ===== Helper Methods Implementation =====

  private initializeGenerationRules(): void {
    // Rule 1: Focus on weaknesses
    this.generationRules.push({
      id: 'focus_weaknesses',
      condition: (playerData, _gameContext) => playerData.weaknesses.length > 0,
      action: (taskType, playerData) => {
        const relevantWeaknesses = playerData.weaknesses.filter(weakness => 
          this.isWeaknessRelevantToTaskType(weakness, taskType)
        );
        
        if (relevantWeaknesses.length > 0) {
          return {
            description: `${taskType.description} - Focus on improving: ${relevantWeaknesses[0]}`,
            rewardConfig: {
              ...taskType.rewardConfig,
              baseXP: taskType.rewardConfig.baseXP * 1.2 // Bonus for weakness improvement
            }
          };
        }
        return {};
      },
      priority: 1
    });

    // Rule 2: Leverage strengths
    this.generationRules.push({
      id: 'leverage_strengths',
      condition: (playerData, _gameContext) => playerData.strengths.length > 0,
      action: (taskType, playerData) => {
        const relevantStrengths = playerData.strengths.filter(strength => 
          this.isStrengthRelevantToTaskType(strength, taskType)
        );
        
        if (relevantStrengths.length > 0) {
          return {
            difficulty: this.increaseDifficulty(taskType.difficulty), // Higher difficulty for strengths
            rewardConfig: {
              ...taskType.rewardConfig,
              difficultyMultiplier: taskType.rewardConfig.difficultyMultiplier * 1.1
            }
          };
        }
        return {};
      },
      priority: 2
    });

    // Rule 3: Context-based adjustments
    this.generationRules.push({
      id: 'context_adjustment',
      condition: (_playerData, gameContext) => !!gameContext.teamSide,
      action: (taskType, _playerData) => {
        // Adjust tasks based on team side and game context
        return {
          parameters: taskType.parameters.map(param => ({
            ...param,
            max: param.max ? Math.floor(param.max * 0.8) : param.max // Reduce targets in competitive context
          }))
        };
      },
      priority: 3
    });
  }

  private determinePriorityCategories(
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): TaskCategory[] {
    const priorities: TaskCategory[] = [];

    // Priority based on weaknesses
    for (const weakness of playerData.weaknesses) {
      if (weakness.includes('aim') || weakness.includes('shooting')) {
        priorities.push(TaskCategory.COMBAT);
      }
      if (weakness.includes('utility') || weakness.includes('grenades')) {
        priorities.push(TaskCategory.UTILITY);
      }
      if (weakness.includes('economy') || weakness.includes('money')) {
        priorities.push(TaskCategory.ECONOMY);
      }
    }

    // Priority based on game context
    if (gameContext.teamSide === 'T') {
      priorities.push(TaskCategory.OBJECTIVE); // Terrorists focus on planting
    } else if (gameContext.teamSide === 'CT') {
      priorities.push(TaskCategory.SUPPORT); // CTs focus on team play
    }

    // Add player preferences if no context-based priorities
    if (priorities.length === 0) {
      priorities.push(...playerData.preferences.taskTypes);
    }

    return [...new Set(priorities)]; // Remove duplicates
  }

  private isTaskTypeApplicable(
    taskType: TaskType,
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext,
    options: any
  ): boolean {
    // Check if task category is in specified categories
    if (options.specificCategories?.length > 0) {
      if (!options.specificCategories.includes(taskType.category)) {
        return false;
      }
    }

    // Check if task matches player preferences
    if (!playerData.preferences.taskTypes.includes(taskType.category)) {
      // Allow if it's a weakness improvement task
      const relevantWeaknesses = playerData.weaknesses.filter(weakness => 
        this.isWeaknessRelevantToTaskType(weakness, taskType)
      );
      if (relevantWeaknesses.length === 0) {
        return false;
      }
    }

    // Check difficulty compatibility
    const maxDifficulty = this.getMaxApplicableDifficulty(playerData);
    if (this.getDifficultyNumericValue(taskType.difficulty) > maxDifficulty) {
      return false;
    }

    // Check context compatibility
    if (!this.isTaskContextCompatible(taskType, gameContext)) {
      return false;
    }

    return true;
  }

  private calculateTaskTypeScore(
    taskType: TaskType,
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): number {
    let score = 0;

    // Base score
    score += 10;

    // Preference bonus
    if (playerData.preferences.taskTypes.includes(taskType.category)) {
      score += 20;
    }

    // Weakness improvement bonus
    const relevantWeaknesses = playerData.weaknesses.filter(weakness => 
      this.isWeaknessRelevantToTaskType(weakness, taskType)
    );
    score += relevantWeaknesses.length * 15;

    // Difficulty match bonus
    const preferredDifficulty = playerData.preferences.difficulty;
    if (taskType.difficulty === preferredDifficulty) {
      score += 10;
    }

    // Context relevance bonus
    if (this.isTaskHighlyRelevantToContext(taskType, gameContext)) {
      score += 25;
    }

    // Recent performance adjustment
    if (playerData.recentPerformance.averageScore > 7 && 
        this.getDifficultyNumericValue(taskType.difficulty) >= 3) {
      score += 10; // Bonus for challenging tasks for good players
    }

    return score;
  }

  private selectOptimalTaskType(
    candidateTypes: TaskType[],
    playerData: PlayerPersonalizationData,
    existingTasks: GeneratedTask[]
  ): TaskType | null {
    // Filter out task types already assigned
    const availableTypes = candidateTypes.filter(type => 
      !existingTasks.some(task => task.taskTypeId === type.id)
    );

    if (availableTypes.length === 0) {
      return null;
    }

    // Select based on variety and priority
    const usedCategories = existingTasks.map(task => {
      const taskType = this.taskTypes.get(task.taskTypeId);
      return taskType?.category;
    });

    // Prefer different categories for variety
    const diverseTypes = availableTypes.filter(type => 
      !usedCategories.includes(type.category)
    );

    return diverseTypes.length > 0 ? diverseTypes[0] : availableTypes[0];
  }

  private personalizeTaskParameters(
    taskType: TaskType,
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const param of taskType.parameters) {
      if (param.type === 'number') {
        parameters[param.name] = this.personalizeNumericParameter(param, playerData, gameContext);
      } else if (param.type === 'string' && param.options) {
        parameters[param.name] = this.personalizeStringParameter(param, playerData, gameContext);
      } else {
        parameters[param.name] = this.getDefaultParameterValue(param);
      }
    }

    return parameters;
  }

  private personalizeNumericParameter(
    param: TaskParameter,
    playerData: PlayerPersonalizationData,
    _gameContext: TaskContext
  ): number {
    const min = param.min || 1;
    const max = param.max || 5;
    
    // Base value is the middle of the range
    let baseValue = Math.floor((min + max) / 2);

    // Adjust based on player skill level
    const relevantSkill = this.getRelevantSkillLevel(param.name, playerData);
    if (relevantSkill > 7) {
      baseValue = Math.min(max, baseValue + 1);
    } else if (relevantSkill < 4) {
      baseValue = Math.max(min, baseValue - 1);
    }

    // Adjust based on consistency
    if (playerData.recentPerformance.consistency < 0.3) {
      baseValue = Math.max(min, baseValue - 1); // Lower targets for inconsistent players
    }

    return baseValue;
  }

  private personalizeStringParameter(
    param: TaskParameter,
    playerData: PlayerPersonalizationData,
    gameContext: TaskContext
  ): string {
    if (!param.options) {
      return '';
    }

    // For weapon type parameters
    if (param.name === 'weaponType') {
      const preferredWeapons = playerData.preferences.focusAreas.filter(area => 
        param.options!.includes(area)
      );
      if (preferredWeapons.length > 0) {
        return preferredWeapons[0];
      }
    }

    // For site-specific parameters
    if (param.name === 'specificSite' && gameContext.mapName) {
      // Could be enhanced with map-specific logic
      return param.options[Math.floor(Math.random() * param.options.length)];
    }

    // Default to first option or random selection
    return param.options[0];
  }

  private adjustTaskDifficulty(
    baseDifficulty: DifficultyLevel,
    playerData: PlayerPersonalizationData
  ): DifficultyLevel {
    const baseValue = this.getDifficultyNumericValue(baseDifficulty);
    let adjustedValue = baseValue;

    // Adjust based on player performance
    if (playerData.recentPerformance.averageScore > 8) {
      adjustedValue = Math.min(5, adjustedValue + 1);
    } else if (playerData.recentPerformance.averageScore < 3) {
      adjustedValue = Math.max(1, adjustedValue - 1);
    }

    // Adjust based on consistency
    if (playerData.recentPerformance.consistency < 0.2) {
      adjustedValue = Math.max(1, adjustedValue - 1);
    }

    return this.getNumericValueDifficulty(adjustedValue);
  }

  private calculateExpectedReward(
    taskType: TaskType,
    difficulty: DifficultyLevel,
    parameters: Record<string, any>
  ): number {
    let reward = taskType.rewardConfig.baseXP;
    
    // Apply difficulty multiplier
    const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
    reward *= difficultyMultiplier;
    
    // Apply parameter-based adjustments
    const primaryParam = taskType.parameters[0];
    if (primaryParam && parameters[primaryParam.name]) {
      const paramValue = parameters[primaryParam.name];
      const paramMultiplier = 1 + (paramValue - 1) * 0.1; // 10% increase per additional unit
      reward *= paramMultiplier;
    }

    return Math.round(reward);
  }

  private generateTaskTitle(taskType: TaskType, parameters: Record<string, any>): string {
    const primaryParam = taskType.parameters[0];
    if (primaryParam && parameters[primaryParam.name]) {
      const value = parameters[primaryParam.name];
      return `${taskType.name}: ${value}`;
    }
    return taskType.name;
  }

  private generateTaskDescription(taskType: TaskType, parameters: Record<string, any>): string {
    let description = taskType.description;
    
    for (const param of taskType.parameters) {
      const value = parameters[param.name];
      if (value !== undefined) {
        description += ` ${param.description}: ${value}.`;
      }
    }
    
    return description;
  }

  private calculateTaskExpiration(taskType: TaskType, gameContext: TaskContext): Date | undefined {
    // Most tasks expire after the current match or session
    const expirationTime = new Date();
    
    if (taskType.category === TaskCategory.OBJECTIVE) {
      expirationTime.setHours(expirationTime.getHours() + 2); // 2 hours for objective tasks
    } else {
      expirationTime.setHours(expirationTime.getHours() + 1); // 1 hour for other tasks
    }
    
    return expirationTime;
  }

  // ===== Task Management Methods =====

  private async storeGeneratedTasks(steamId: string, tasks: GeneratedTask[]): Promise<void> {
    const sql = `
      INSERT INTO generated_tasks (id, player_id, task_type_id, title, description, parameters, 
                                  completion_criteria, difficulty, expected_reward, status, 
                                  created_at, expires_at, progress, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const task of tasks) {
      try {
        await new Promise<void>((resolve, reject) => {
          db.run(sql, [
            task.id,
            task.playerId,
            task.taskTypeId,
            task.title,
            task.description,
            JSON.stringify(task.parameters),
            JSON.stringify(task.completionCriteria),
            task.difficulty,
            task.expectedReward,
            task.status,
            task.createdAt.toISOString(),
            task.expiresAt?.toISOString(),
            JSON.stringify(task.progress),
            JSON.stringify(task.context)
          ], function(err) {
            if (err) {
              console.error('❌ Error storing task:', err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.error('❌ Error storing task:', error);
      }
    }
  }

  private async getActiveTasksForPlayer(steamId: string): Promise<GeneratedTask[]> {
    // Check cache first
    if (this.activeTasksCache.has(steamId)) {
      return this.activeTasksCache.get(steamId)!;
    }

    // Query database
    const sql = `
      SELECT * FROM generated_tasks 
      WHERE player_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))
    `;

    return new Promise((resolve, reject) => {
      db.all(sql, [steamId], (err, rows: any[]) => {
        if (err) {
          console.error('❌ Error getting active tasks:', err);
          reject(err);
        } else {
          const tasks = rows.map(row => this.mapRowToGeneratedTask(row));
          this.activeTasksCache.set(steamId, tasks);
          resolve(tasks);
        }
      });
    });
  }

  private calculateProgressUpdate(task: GeneratedTask, gameEvent: GameEvent): TaskProgressUpdate | null {
    // This would be enhanced based on the specific task type and game event
    if (!this.isEventRelevantToTask(task, gameEvent)) {
      return null;
    }

    const progressDelta = this.calculateProgressDelta(task, gameEvent);
    if (progressDelta <= 0) {
      return null;
    }

    const newProgress = task.progress.current + progressDelta;
    const completed = newProgress >= task.progress.target;

    return {
      taskId: task.id,
      previousProgress: task.progress.current,
      newProgress: newProgress,
      delta: progressDelta,
      completed,
      rewardEarned: completed ? task.expectedReward : undefined,
      timestamp: new Date()
    };
  }

  private async applyProgressUpdate(taskId: string, update: TaskProgressUpdate): Promise<void> {
    const sql = `
      UPDATE generated_tasks 
      SET progress = json_set(progress, '$.current', 
                             CAST(json_extract(progress, '$.current') AS INTEGER) + ?),
          progress = json_set(progress, '$.percentage', 
                             ROUND(CAST(json_extract(progress, '$.current') AS REAL) / 
                                   CAST(json_extract(progress, '$.target') AS REAL) * 100, 2)),
          progress = json_set(progress, '$.lastUpdated', ?)
      WHERE id = ?
    `;

    return new Promise<void>((resolve, reject) => {
      db.run(sql, [update.delta, update.timestamp.toISOString(), taskId], function(err) {
        if (err) {
          console.error('❌ Error applying progress update:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async completeTask(taskId: string): Promise<void> {
    const sql = `UPDATE generated_tasks SET status = 'completed' WHERE id = ?`;
    
    return new Promise<void>((resolve, reject) => {
      db.run(sql, [taskId], function(err) {
        if (err) {
          console.error('❌ Error completing task:', err);
          reject(err);
        } else {
          console.log(`✅ Task ${taskId} completed`);
          resolve();
        }
      });
    });
  }

  // ===== Utility Methods =====

  private isWeaknessRelevantToTaskType(weakness: string, taskType: TaskType): boolean {
    const weaknessLower = weakness.toLowerCase();
    const categoryKeywords: Record<TaskCategory, string[]> = {
      [TaskCategory.COMBAT]: ['aim', 'shooting', 'duels', 'kills'],
      [TaskCategory.UTILITY]: ['grenades', 'utility', 'flash', 'smoke'],
      [TaskCategory.ECONOMY]: ['money', 'economy', 'buying', 'save'],
      [TaskCategory.OBJECTIVE]: ['bomb', 'plant', 'defuse', 'site'],
      [TaskCategory.SUPPORT]: ['support', 'team', 'assist', 'help']
    };

    const keywords = categoryKeywords[taskType.category] || [];
    return keywords.some(keyword => weaknessLower.includes(keyword));
  }

  private isStrengthRelevantToTaskType(strength: string, taskType: TaskType): boolean {
    return this.isWeaknessRelevantToTaskType(strength, taskType); // Same logic
  }

  private increaseDifficulty(difficulty: DifficultyLevel): DifficultyLevel {
    const current = this.getDifficultyNumericValue(difficulty);
    const increased = Math.min(5, current + 1);
    return this.getNumericValueDifficulty(increased);
  }

  private getMaxApplicableDifficulty(playerData: PlayerPersonalizationData): number {
    const avgSkill = Object.values(playerData.skillLevel).reduce((a, b) => a + b, 0) / 
                    Object.values(playerData.skillLevel).length;
    
    if (avgSkill < 3) return 2; // Max intermediate
    if (avgSkill < 6) return 3; // Max advanced
    if (avgSkill < 8) return 4; // Max expert
    return 5; // Elite
  }

  private isTaskContextCompatible(taskType: TaskType, gameContext: TaskContext): boolean {
    // Objective tasks require team side context
    if (taskType.category === TaskCategory.OBJECTIVE && !gameContext.teamSide) {
      return false;
    }
    
    // Economy tasks are more relevant in competitive contexts
    if (taskType.category === TaskCategory.ECONOMY && gameContext.gameMode === 'casual') {
      return false;
    }
    
    return true;
  }

  private isTaskHighlyRelevantToContext(taskType: TaskType, gameContext: TaskContext): boolean {
    if (taskType.category === TaskCategory.OBJECTIVE && gameContext.teamSide === 'T') {
      return true; // Bomb plants for terrorists
    }
    
    if (taskType.category === TaskCategory.SUPPORT && gameContext.teamSide === 'CT') {
      return true; // Support tasks for counter-terrorists
    }
    
    return false;
  }

  private getDifficultyNumericValue(difficulty: DifficultyLevel): number {
    const mapping = {
      [DifficultyLevel.BEGINNER]: 1,
      [DifficultyLevel.INTERMEDIATE]: 2,
      [DifficultyLevel.ADVANCED]: 3,
      [DifficultyLevel.EXPERT]: 4,
      [DifficultyLevel.ELITE]: 5
    };
    return mapping[difficulty];
  }

  private getNumericValueDifficulty(value: number): DifficultyLevel {
    const mapping = {
      1: DifficultyLevel.BEGINNER,
      2: DifficultyLevel.INTERMEDIATE,
      3: DifficultyLevel.ADVANCED,
      4: DifficultyLevel.EXPERT,
      5: DifficultyLevel.ELITE
    };
    return mapping[value as keyof typeof mapping] || DifficultyLevel.INTERMEDIATE;
  }

  private getDifficultyMultiplier(difficulty: DifficultyLevel): number {
    const mapping = {
      [DifficultyLevel.BEGINNER]: 0.8,
      [DifficultyLevel.INTERMEDIATE]: 1.0,
      [DifficultyLevel.ADVANCED]: 1.3,
      [DifficultyLevel.EXPERT]: 1.6,
      [DifficultyLevel.ELITE]: 2.0
    };
    return mapping[difficulty];
  }

  private getRelevantSkillLevel(paramName: string, playerData: PlayerPersonalizationData): number {
    const skillMapping: Record<string, keyof typeof playerData.skillLevel> = {
      'killCount': 'aim',
      'headshotCount': 'aim',
      'assistCount': 'teamwork',
      'saveCount': 'gameKnowledge',
      'plantCount': 'gameKnowledge'
    };
    
    const skillKey = skillMapping[paramName] || 'consistency';
    return playerData.skillLevel[skillKey] || 5;
  }

  private getDefaultParameterValue(param: TaskParameter): any {
    switch (param.type) {
      case 'number':
        return param.min || 1;
      case 'string':
        return param.options?.[0] || '';
      case 'boolean':
        return false;
      case 'array':
        return [];
      default:
        return null;
    }
  }

  private mapRowToGeneratedTask(row: any): GeneratedTask {
    return {
      id: row.id,
      playerId: row.player_id,
      taskTypeId: row.task_type_id,
      title: row.title,
      description: row.description,
      parameters: JSON.parse(row.parameters || '{}'),
      completionCriteria: JSON.parse(row.completion_criteria || '{}'),
      difficulty: row.difficulty,
      expectedReward: row.expected_reward,
      status: row.status,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      progress: JSON.parse(row.progress || '{}'),
      context: JSON.parse(row.context || '{}')
    };
  }

  private isEventRelevantToTask(task: GeneratedTask, gameEvent: GameEvent): boolean {
    const taskType = this.taskTypes.get(task.taskTypeId);
    if (!taskType) return false;

    // Map game events to task categories
    const eventMapping: Record<string, TaskCategory[]> = {
      'player_kill': [TaskCategory.COMBAT],
      'player_death': [TaskCategory.COMBAT],
      'bomb_plant': [TaskCategory.OBJECTIVE],
      'bomb_defuse': [TaskCategory.OBJECTIVE],
      'flash_assist': [TaskCategory.UTILITY],
      'money_save': [TaskCategory.ECONOMY]
    };

    const relevantCategories = eventMapping[gameEvent.type] || [];
    return relevantCategories.includes(taskType.category);
  }

  private calculateProgressDelta(task: GeneratedTask, gameEvent: GameEvent): number {
    // This would be enhanced with specific logic for each task type and event type
    const taskType = this.taskTypes.get(task.taskTypeId);
    if (!taskType) return 0;

    // Simple mapping for now - could be much more sophisticated
    const progressMapping: Record<string, number> = {
      'player_kill': 1,
      'bomb_plant': 1,
      'flash_assist': 1,
      'money_save': 1
    };

    return progressMapping[gameEvent.type] || 0;
  }

  // ===== Public API Methods =====

  /**
   * Get all active tasks for a player
   */
  async getPlayerTasks(steamId: string): Promise<GeneratedTask[]> {
    return this.getActiveTasksForPlayer(steamId);
  }

  /**
   * Cancel a specific task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const sql = `UPDATE generated_tasks SET status = 'cancelled' WHERE id = ?`;
    
    return new Promise<boolean>((resolve, reject) => {
      db.run(sql, [taskId], function(err) {
        if (err) {
          console.error('❌ Error cancelling task:', err);
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Get task generation statistics
   */
  getGenerationStats(): TaskGenerationStats {
    return {
      totalTasksGenerated: 0, // Would be tracked in real implementation
      averageCompletionRate: 0.75,
      popularTaskCategories: [TaskCategory.COMBAT, TaskCategory.OBJECTIVE],
      playerSatisfactionScore: 8.2
    };
  }
}

// ===== Additional Supporting Types =====

interface TaskGenerationStats {
  totalTasksGenerated: number;
  averageCompletionRate: number;
  popularTaskCategories: TaskCategory[];
  playerSatisfactionScore: number;
}

// ===== Factory Functions =====

export async function createTaskGenerationService(memoryService: MemoryService): Promise<TaskGenerationService> {
  const service = new TaskGenerationService(memoryService);
  console.log('✅ TaskGenerationService created successfully');
  return service;
} 