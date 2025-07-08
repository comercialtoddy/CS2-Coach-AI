/**
 * Reward Assignment Controller
 * 
 * Handles HTTP endpoints for the reward assignment system.
 * Provides APIs for viewing rewards, statistics, and managing the reward system.
 */

import { Request, Response } from 'express';
import { RewardAssignmentService, Reward } from '../services/rewardAssignmentService.js';
import { TaskGenerationService } from '../services/taskGenerationServices.js';
import { MemoryService, createMemoryService } from '../ai/memory/MemoryService.js';
import { asyncHandler } from '../helpers/asyncHandler.js';

// Global service instances
let rewardAssignmentService: RewardAssignmentService | null = null;
let taskGenerationService: TaskGenerationService | null = null;
let memoryService: MemoryService | null = null;

/**
 * Initialize the reward assignment services
 */
async function initializeServices(): Promise<void> {
  if (!memoryService) {
    memoryService = await createMemoryService();
    await memoryService.initialize();
  }
  
  if (!taskGenerationService) {
    taskGenerationService = new TaskGenerationService(memoryService);
    console.log('✅ TaskGenerationService initialized for rewards');
  }
  
  if (!rewardAssignmentService) {
    const { createRewardAssignmentService } = await import('../services/rewardAssignmentService.js');
    rewardAssignmentService = await createRewardAssignmentService(memoryService, taskGenerationService);
    console.log('✅ RewardAssignmentService initialized');
  }
}

/**
 * Get player's reward history
 * GET /api/rewards/player/:steamId
 */
export const getPlayerRewards = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.params;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    const rewards = await rewardAssignmentService!.getPlayerRewards(steamId);
    
    res.json({
      success: true,
      data: {
        steamId,
        rewards,
        totalRewards: rewards.length,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting player rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player rewards',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get player's reward statistics
 * GET /api/rewards/player/:steamId/stats
 */
export const getPlayerRewardStats = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.params;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    const stats = await rewardAssignmentService!.getPlayerRewardStats(steamId);
    
    res.json({
      success: true,
      data: {
        steamId,
        ...stats,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting player reward stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player reward statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get system-wide reward statistics
 * GET /api/rewards/stats
 */
export const getSystemStats = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  try {
    const stats = rewardAssignmentService!.getSystemStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting reward system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reward system statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for the reward assignment system
 * GET /api/rewards/health
 */
export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  try {
    await initializeServices();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        rewardAssignment: rewardAssignmentService ? 'active' : 'inactive',
        taskGeneration: taskGenerationService ? 'active' : 'inactive',
        memory: memoryService ? 'active' : 'inactive'
      },
      stats: rewardAssignmentService?.getSystemStats() || {},
      version: '1.0.0'
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('❌ Reward system health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test the reward assignment pipeline
 * POST /api/rewards/test
 */
export const testRewardPipeline = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.body;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    console.log(`🧪 Testing reward assignment pipeline for player ${steamId}`);
    
    // Step 1: Generate a test task
    const gameContext = {
      gameMode: 'competitive',
      mapName: 'de_dust2',
      teamSide: 'CT' as const,
      roundNumber: 1,
      economicState: 'buy',
      teamComposition: [],
      situationalFactors: []
    };
    
    const tasks = await taskGenerationService!.generateTasksForPlayer(
      steamId,
      gameContext,
      { maxTasks: 1 }
    );
    
    if (tasks.length === 0) {
      throw new Error('Failed to generate test task');
    }
    
    const task = tasks[0];
    
    // Step 2: Simulate task completion
    task.progress = {
      current: task.progress.target,
      target: task.progress.target,
      percentage: 100,
      lastUpdated: new Date(),
      checkpoints: []
    };
    
    // Step 3: Trigger reward assignment
    await rewardAssignmentService!.handleTaskCompletion(steamId, task);
    
    // Step 4: Get reward history
    const rewards = await rewardAssignmentService!.getPlayerRewards(steamId);
    const stats = await rewardAssignmentService!.getPlayerRewardStats(steamId);
    
    res.json({
      success: true,
      data: {
        testSummary: {
          steamId,
          taskGenerated: task,
          rewardsAssigned: rewards.length,
          rewardStats: stats
        },
        task,
        rewards: rewards.slice(0, 5), // Get last 5 rewards
        stats,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error testing reward pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test reward pipeline',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export all controller functions
export default {
  getPlayerRewards,
  getPlayerRewardStats,
  getSystemStats,
  healthCheck,
  testRewardPipeline
}; 