/**
 * Reward Assignment Service
 * 
 * Handles the calculation, assignment, and distribution of rewards for completed tasks.
 * Integrates with the task generation system and player profiles to provide personalized rewards.
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import db from '../../database/database.js';
import { MemoryService } from '../ai/memory/MemoryService.js';
import { MemoryType, MemoryImportance } from '../ai/interfaces/MemoryService.js';
import { TaskGenerationService, GeneratedTask, TaskStatus, DifficultyLevel } from './taskGenerationServices.js';

export interface Reward {
  id: string;
  playerId: string;
  taskId: string;
  type: RewardType;
  value: number;
  multiplier: number;
  totalValue: number;
  bonuses: RewardBonus[];
  timestamp: Date;
  context: RewardContext;
}

export enum RewardType {
  XP = 'xp',
  ACHIEVEMENT = 'achievement',
  INSIGHT = 'insight',
  BONUS = 'bonus'
}

export interface RewardBonus {
  type: string;
  description: string;
  multiplier: number;
}

export interface RewardContext {
  taskType: string;
  difficulty: DifficultyLevel;
  completionTime: number;
  performance: number;
  streak: number;
}

export interface RewardCalculationResult {
  baseValue: number;
  multiplier: number;
  bonuses: RewardBonus[];
  totalValue: number;
  breakdown: {
    base: number;
    difficulty: number;
    performance: number;
    streak: number;
    bonuses: { [key: string]: number };
  };
}

interface PlayerProfileData {
  steamId: string;
  playingStyle: {
    aggression: number;
    adaptability: number;
    teamwork: number;
    consistency: number;
    preferredRoles: string[];
  };
  improvementGoals: Array<{ goal: string }>;
  weaknesses: Array<{ description: string; category: string }>;
  strengths: Array<{ description: string }>;
  mentalState: {
    motivationFactors: string[];
  };
  rewards?: {
    xp: number;
    level: number;
    tasksCompleted: number;
    totalXP: number;
  };
}

interface DatabaseRow {
  id: string;
  player_id: string;
  task_id: string;
  type: string;
  value: number;
  multiplier: number;
  total_value: number;
  bonuses: string;
  timestamp: string;
  context: string;
}

export class RewardAssignmentService extends EventEmitter {
  private memoryService: MemoryService;
  private taskGenerationService: TaskGenerationService;
  private rewardCache: Map<string, Reward[]> = new Map();
  private streakTracker: Map<string, number> = new Map();
  
  constructor(
    memoryService: MemoryService,
    taskGenerationService: TaskGenerationService
  ) {
    super();
    this.memoryService = memoryService;
    this.taskGenerationService = taskGenerationService;
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for task completion
   */
  private setupEventListeners(): void {
    this.taskGenerationService.on('taskCompleted', async (data) => {
      const { steamId, task, reward } = data;
      await this.handleTaskCompletion(steamId, task, reward);
    });
  }

  /**
   * Handle task completion and assign rewards
   */
  public async handleTaskCompletion(
    steamId: string,
    task: GeneratedTask,
    baseReward?: number
  ): Promise<void> {
    try {
      console.log(`🎁 Calculating rewards for player ${steamId} - Task ${task.id}`);
      
      // Calculate reward value
      const calculationResult = await this.calculateReward(steamId, task, baseReward);
      
      // Create reward record
      const reward: Reward = {
        id: randomUUID(),
        playerId: steamId,
        taskId: task.id,
        type: RewardType.XP,
        value: calculationResult.baseValue,
        multiplier: calculationResult.multiplier,
        totalValue: calculationResult.totalValue,
        bonuses: calculationResult.bonuses,
        timestamp: new Date(),
        context: {
          taskType: task.taskTypeId,
          difficulty: task.difficulty,
          completionTime: this.calculateCompletionTime(task),
          performance: this.calculatePerformance(task),
          streak: this.getPlayerStreak(steamId)
        }
      };

      // Store reward
      await this.storeReward(reward);
      
      // Update player profile
      await this.updatePlayerProfile(steamId, reward);
      
      // Update streak
      this.updateStreak(steamId, true);
      
      // Cache reward
      this.cacheReward(steamId, reward);
      
      // Emit reward assigned event
      this.emit('rewardAssigned', {
        playerId: steamId,
        reward,
        calculation: calculationResult
      });

      console.log(`✅ Reward assigned to player ${steamId}: ${reward.totalValue} XP`);
    } catch (error) {
      console.error('❌ Error assigning reward:', error);
      this.emit('error', error);
      
      // Reset streak on error
      this.updateStreak(steamId, false);
    }
  }

  /**
   * Calculate reward value based on task and player context
   */
  private async calculateReward(
    steamId: string,
    task: GeneratedTask,
    baseReward?: number
  ): Promise<RewardCalculationResult> {
    // Start with base value (from task or default calculation)
    const base = baseReward || this.calculateBaseReward(task);
    
    // Get player profile for personalization
    const profile = await this.memoryService.getPlayerProfile(steamId);
    
    // Calculate multipliers
    const difficultyMultiplier = this.getDifficultyMultiplier(task.difficulty);
    const performanceMultiplier = this.calculatePerformanceMultiplier(task);
    const streakMultiplier = this.calculateStreakMultiplier(steamId);
    
    // Calculate bonuses
    const bonuses = await this.calculateBonuses(steamId, task, profile?.data);
    const bonusMultiplier = bonuses.reduce((total, bonus) => total + bonus.multiplier, 0);
    
    // Calculate total multiplier
    const totalMultiplier = (
      difficultyMultiplier *
      performanceMultiplier *
      streakMultiplier *
      (1 + bonusMultiplier) // Bonuses are additive to avoid exponential scaling
    );
    
    // Calculate total value
    const totalValue = Math.round(base * totalMultiplier);
    
    return {
      baseValue: base,
      multiplier: totalMultiplier,
      bonuses,
      totalValue,
      breakdown: {
        base,
        difficulty: difficultyMultiplier,
        performance: performanceMultiplier,
        streak: streakMultiplier,
        bonuses: bonuses.reduce((acc, bonus) => {
          acc[bonus.type] = bonus.multiplier;
          return acc;
        }, {} as { [key: string]: number })
      }
    };
  }

  /**
   * Calculate base reward value for a task
   */
  private calculateBaseReward(task: GeneratedTask): number {
    // Base values by difficulty
    const baseValues = {
      [DifficultyLevel.BEGINNER]: 50,
      [DifficultyLevel.INTERMEDIATE]: 100,
      [DifficultyLevel.ADVANCED]: 200,
      [DifficultyLevel.EXPERT]: 400,
      [DifficultyLevel.ELITE]: 800
    };
    
    return baseValues[task.difficulty] || 100;
  }

  /**
   * Get multiplier based on task difficulty
   */
  private getDifficultyMultiplier(difficulty: DifficultyLevel): number {
    const multipliers = {
      [DifficultyLevel.BEGINNER]: 1.0,
      [DifficultyLevel.INTERMEDIATE]: 1.2,
      [DifficultyLevel.ADVANCED]: 1.5,
      [DifficultyLevel.EXPERT]: 2.0,
      [DifficultyLevel.ELITE]: 3.0
    };
    
    return multipliers[difficulty] || 1.0;
  }

  /**
   * Calculate performance multiplier based on task completion
   */
  private calculatePerformanceMultiplier(task: GeneratedTask): number {
    // This could be enhanced with more sophisticated performance metrics
    const performance = this.calculatePerformance(task);
    
    if (performance >= 0.9) return 1.5; // Exceptional
    if (performance >= 0.7) return 1.2; // Good
    if (performance >= 0.5) return 1.0; // Average
    return 0.8; // Below average
  }

  /**
   * Calculate streak multiplier for consecutive task completions
   */
  private calculateStreakMultiplier(steamId: string): number {
    const streak = this.getPlayerStreak(steamId);
    
    if (streak >= 10) return 2.0;    // 10+ streak
    if (streak >= 5) return 1.5;     // 5-9 streak
    if (streak >= 3) return 1.2;     // 3-4 streak
    return 1.0;                      // No streak bonus
  }

  /**
   * Calculate additional bonuses based on context
   */
  private async calculateBonuses(
    steamId: string,
    task: GeneratedTask,
    profile: any
  ): Promise<RewardBonus[]> {
    const bonuses: RewardBonus[] = [];
    
    // First completion bonus
    const isFirstCompletion = await this.isFirstTaskCompletion(steamId, task.taskTypeId);
    if (isFirstCompletion) {
      bonuses.push({
        type: 'first_completion',
        description: 'First time completing this type of task',
        multiplier: 0.5 // +50% bonus
      });
    }
    
    // Improvement bonus (if task targets a weakness)
    if (profile?.weaknesses?.some((w: any) => 
      task.taskTypeId.toLowerCase().includes(w.category.toLowerCase())
    )) {
      bonuses.push({
        type: 'improvement',
        description: 'Task targets improvement area',
        multiplier: 0.3 // +30% bonus
      });
    }
    
    // Quick completion bonus
    const completionTime = this.calculateCompletionTime(task);
    if (completionTime && completionTime < 300) { // Less than 5 minutes
      bonuses.push({
        type: 'quick_completion',
        description: 'Task completed quickly',
        multiplier: 0.2 // +20% bonus
      });
    }
    
    return bonuses;
  }

  /**
   * Store reward in database
   */
  private async storeReward(reward: Reward): Promise<void> {
    const sql = `
      INSERT INTO rewards (
        id, player_id, task_id, type, value, multiplier, total_value,
        bonuses, timestamp, context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise<void>((resolve, reject) => {
      db.run(sql, [
        reward.id,
        reward.playerId,
        reward.taskId,
        reward.type,
        reward.value,
        reward.multiplier,
        reward.totalValue,
        JSON.stringify(reward.bonuses),
        reward.timestamp.toISOString(),
        JSON.stringify(reward.context)
      ], function(err) {
        if (err) {
          console.error('❌ Error storing reward:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update player profile with reward
   */
  private async updatePlayerProfile(steamId: string, reward: Reward): Promise<void> {
    try {
      const profile = await this.memoryService.getPlayerProfile(steamId);
      if (!profile) return;

      const data = profile.data as PlayerProfileData;
      
      // Initialize rewards object if it doesn't exist
      if (!data.rewards) {
        data.rewards = {
          xp: 0,
          level: 1,
          tasksCompleted: 0,
          totalXP: 0
        };
      }

      // Update XP
      data.rewards.xp = (data.rewards.xp || 0) + reward.totalValue;
      
      // Update level if needed
      const newLevel = this.calculateLevel(data.rewards.xp);
      if (newLevel > (data.rewards.level || 0)) {
        data.rewards.level = newLevel;
        this.emit('playerLevelUp', {
          playerId: steamId,
          newLevel,
          oldLevel: data.rewards.level
        });
      }
      
      // Update task completion stats
      data.rewards.tasksCompleted = (data.rewards.tasksCompleted || 0) + 1;
      data.rewards.totalXP = (data.rewards.totalXP || 0) + reward.totalValue;
      
      // Store updated profile using store method
      await this.memoryService.store({
        type: MemoryType.PLAYER_PROFILE,
        importance: MemoryImportance.HIGH,
        tags: ['rewards', 'profile'],
        metadata: {},
        data
      });
    } catch (error) {
      console.error('❌ Error updating player profile:', error);
      this.emit('error', error);
    }
  }

  /**
   * Cache reward for quick access
   */
  private cacheReward(steamId: string, reward: Reward): void {
    const playerRewards = this.rewardCache.get(steamId) || [];
    playerRewards.push(reward);
    
    // Keep only last 100 rewards in cache
    if (playerRewards.length > 100) {
      playerRewards.shift();
    }
    
    this.rewardCache.set(steamId, playerRewards);
  }

  /**
   * Get player's current completion streak
   */
  private getPlayerStreak(steamId: string): number {
    return this.streakTracker.get(steamId) || 0;
  }

  /**
   * Update player's completion streak
   */
  private updateStreak(steamId: string, success: boolean): void {
    if (success) {
      const currentStreak = this.getPlayerStreak(steamId);
      this.streakTracker.set(steamId, currentStreak + 1);
    } else {
      this.streakTracker.set(steamId, 0);
    }
  }

  /**
   * Calculate task completion time in seconds
   */
  private calculateCompletionTime(task: GeneratedTask): number {
    const created = new Date(task.createdAt).getTime();
    const completed = new Date().getTime();
    return Math.floor((completed - created) / 1000);
  }

  /**
   * Calculate task completion performance (0-1)
   */
  private calculatePerformance(task: GeneratedTask): number {
    // This could be enhanced with more sophisticated metrics
    return task.progress.percentage / 100;
  }

  /**
   * Calculate player level based on XP
   */
  private calculateLevel(xp: number): number {
    // Simple level calculation: each level requires 1000 XP
    return Math.floor(xp / 1000) + 1;
  }

  /**
   * Check if this is the first time completing this type of task
   */
  private async isFirstTaskCompletion(
    steamId: string,
    taskTypeId: string
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as count
        FROM rewards r
        JOIN generated_tasks t ON r.task_id = t.id
        WHERE r.player_id = ? AND t.task_type_id = ?
      `;
      
      db.get(sql, [steamId, taskTypeId], (err, row: any) => {
        if (err) {
          console.error('❌ Error checking first completion:', err);
          reject(err);
        } else {
          resolve(row.count === 0);
        }
      });
    });
  }

  /**
   * Get player's reward history
   */
  public async getPlayerRewards(steamId: string): Promise<Reward[]> {
    // Try cache first
    const cachedRewards = this.rewardCache.get(steamId);
    if (cachedRewards) {
      return cachedRewards;
    }
    
    // Fallback to database
    return new Promise<Reward[]>((resolve, reject) => {
      const sql = `
        SELECT * FROM rewards
        WHERE player_id = ?
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      
      db.all(sql, [steamId], (err, rows: DatabaseRow[]) => {
        if (err) {
          console.error('❌ Error getting player rewards:', err);
          reject(err);
        } else {
          const rewards = rows.map(row => ({
            id: row.id,
            playerId: row.player_id,
            taskId: row.task_id,
            type: row.type as RewardType,
            value: row.value,
            multiplier: row.multiplier,
            totalValue: row.total_value,
            bonuses: JSON.parse(row.bonuses),
            context: JSON.parse(row.context),
            timestamp: new Date(row.timestamp)
          }));
          
          // Update cache
          this.rewardCache.set(steamId, rewards);
          
          resolve(rewards);
        }
      });
    });
  }

  /**
   * Get reward statistics for a player
   */
  public async getPlayerRewardStats(steamId: string): Promise<any> {
    const rewards = await this.getPlayerRewards(steamId);
    
    return {
      totalRewards: rewards.length,
      totalXP: rewards.reduce((sum, r) => sum + r.totalValue, 0),
      averageXP: Math.round(
        rewards.reduce((sum, r) => sum + r.totalValue, 0) / rewards.length
      ),
      highestReward: Math.max(...rewards.map(r => r.totalValue)),
      streakBonus: this.calculateStreakMultiplier(steamId),
      currentStreak: this.getPlayerStreak(steamId),
      recentRewards: rewards.slice(0, 5)
    };
  }

  /**
   * Get system-wide reward statistics
   */
  public getSystemStats(): any {
    return {
      activePlayers: this.streakTracker.size,
      totalCachedRewards: Array.from(this.rewardCache.values())
        .reduce((sum, rewards) => sum + rewards.length, 0),
      averageStreak: Math.round(
        Array.from(this.streakTracker.values())
          .reduce((sum, streak) => sum + streak, 0) / 
        this.streakTracker.size
      ),
      cacheSize: this.rewardCache.size,
      lastUpdate: new Date()
    };
  }
}

/**
 * Create and initialize the reward assignment service
 */
export async function createRewardAssignmentService(
  memoryService: MemoryService,
  taskGenerationService: TaskGenerationService
): Promise<RewardAssignmentService> {
  const service = new RewardAssignmentService(memoryService, taskGenerationService);
  
  // Create rewards table if it doesn't exist
  const sql = `
    CREATE TABLE IF NOT EXISTS rewards (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value INTEGER NOT NULL,
      multiplier REAL NOT NULL,
      total_value INTEGER NOT NULL,
      bonuses TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      context TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(steamid),
      FOREIGN KEY (task_id) REFERENCES generated_tasks(id)
    )
  `;
  
  return new Promise<RewardAssignmentService>((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        console.error('❌ Error creating rewards table:', err);
        reject(err);
      } else {
        console.log('✅ RewardAssignmentService created successfully');
        resolve(service);
      }
    });
  });
}

export default RewardAssignmentService; 