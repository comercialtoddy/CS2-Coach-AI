/**
 * Task Generation Controller
 * 
 * Handles HTTP endpoints for the dynamic task generation system.
 * Provides APIs for generating, managing, and tracking personalized player tasks.
 */

import { Request, Response } from 'express';
import { 
  TaskGenerationService, 
  GeneratedTask, 
  TaskCategory,
  DifficultyLevel,
  TaskContext,
  TaskStatus
} from '../services/taskGenerationServices.js';
import { MemoryService, createMemoryService } from '../ai/memory/MemoryService.js';
import { asyncHandler } from '../helpers/asyncHandler.js';

// Global service instances
let taskGenerationService: TaskGenerationService | null = null;
let memoryService: MemoryService | null = null;

/**
 * Initialize the task generation service
 */
async function initializeServices(): Promise<void> {
  if (!memoryService) {
    memoryService = await createMemoryService();
    await memoryService.initialize();
  }
  
  if (!taskGenerationService) {
    taskGenerationService = new TaskGenerationService(memoryService);
    console.log('✅ TaskGenerationService initialized');
  }
}

/**
 * Generate personalized tasks for a player
 * POST /api/tasks/generate
 */
export const generateTasks = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId, gameContext, options } = req.body;
  
  // Validate required parameters
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  // Validate and parse game context
  const context: TaskContext = {
    gameMode: gameContext?.gameMode || 'competitive',
    mapName: gameContext?.mapName,
    teamSide: gameContext?.teamSide,
    roundNumber: gameContext?.roundNumber,
    economicState: gameContext?.economicState,
    teamComposition: gameContext?.teamComposition || [],
    situationalFactors: gameContext?.situationalFactors || []
  };

  // Validate and parse options
  const generationOptions = {
    maxTasks: options?.maxTasks || 2,
    forceRefresh: options?.forceRefresh || false,
    specificCategories: options?.specificCategories || []
  };

  try {
    console.log(`🎯 Generating tasks for player ${steamId}`);
    
    const tasks = await taskGenerationService!.generateTasksForPlayer(
      steamId,
      context,
      generationOptions
    );

    res.json({
      success: true,
      data: {
        tasks,
        generatedAt: new Date().toISOString(),
        context,
        totalTasks: tasks.length
      }
    });
  } catch (error) {
    console.error('❌ Error generating tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active tasks for a player
 * GET /api/tasks/player/:steamId
 */
export const getPlayerTasks = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.params;
  const { status } = req.query;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    const tasks = await taskGenerationService!.getPlayerTasks(steamId);
    
    // Filter by status if specified
    let filteredTasks = tasks;
    if (status && typeof status === 'string') {
      filteredTasks = tasks.filter(task => task.status === status);
    }

    res.json({
      success: true,
      data: {
        tasks: filteredTasks,
        totalTasks: filteredTasks.length,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting player tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update task progress based on game events
 * POST /api/tasks/progress
 */
export const updateTaskProgress = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId, gameEvent } = req.body;
  
  if (!steamId || !gameEvent) {
    return res.status(400).json({
      success: false,
      error: 'steamId and gameEvent are required'
    });
  }

  // Validate game event structure
  if (!gameEvent.type || !gameEvent.data) {
    return res.status(400).json({
      success: false,
      error: 'gameEvent must have type and data properties'
    });
  }

  const event = {
    type: gameEvent.type,
    data: gameEvent.data,
    timestamp: new Date(gameEvent.timestamp || Date.now()),
    playerId: steamId
  };

  try {
    const updates = await taskGenerationService!.updateTaskProgress(steamId, event);

    res.json({
      success: true,
      data: {
        updates,
        totalUpdates: updates.length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error updating task progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel a specific task
 * POST /api/tasks/:taskId/cancel
 */
export const cancelTask = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'taskId is required'
    });
  }

  try {
    const success = await taskGenerationService!.cancelTask(taskId);
    
    if (success) {
      res.json({
        success: true,
        data: {
          taskId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Task not found or could not be cancelled'
      });
    }
  } catch (error) {
    console.error('❌ Error cancelling task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get task generation statistics
 * GET /api/tasks/stats
 */
export const getTaskStats = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  try {
    const stats = taskGenerationService!.getGenerationStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting task stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get task statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get available task categories and types
 * GET /api/tasks/types
 */
export const getTaskTypes = asyncHandler(async (req: Request, res: Response) => {
  try {
    const categories = Object.values(TaskCategory);
    const difficulties = Object.values(DifficultyLevel);
    const statuses = Object.values(TaskStatus);
    
    res.json({
      success: true,
      data: {
        categories,
        difficulties,
        statuses,
        description: 'Available task configuration options'
      }
    });
  } catch (error) {
    console.error('❌ Error getting task types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get task types',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate task generation request
 * POST /api/tasks/validate
 */
export const validateTaskRequest = asyncHandler(async (req: Request, res: Response) => {
  const { steamId, gameContext, options } = req.body;
  
  const validation = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[]
  };
  
  // Validate steamId
  if (!steamId || typeof steamId !== 'string') {
    validation.isValid = false;
    validation.errors.push('steamId must be a non-empty string');
  }
  
  // Validate gameContext
  if (gameContext) {
    if (gameContext.teamSide && !['CT', 'T'].includes(gameContext.teamSide)) {
      validation.isValid = false;
      validation.errors.push('teamSide must be either "CT" or "T"');
    }
    
    if (gameContext.roundNumber && (typeof gameContext.roundNumber !== 'number' || gameContext.roundNumber < 0)) {
      validation.isValid = false;
      validation.errors.push('roundNumber must be a non-negative number');
    }
  }
  
  // Validate options
  if (options) {
    if (options.maxTasks && (typeof options.maxTasks !== 'number' || options.maxTasks < 1 || options.maxTasks > 10)) {
      validation.isValid = false;
      validation.errors.push('maxTasks must be a number between 1 and 10');
    }
    
    if (options.specificCategories && Array.isArray(options.specificCategories)) {
      const validCategories = Object.values(TaskCategory);
      const invalidCategories = options.specificCategories.filter((cat: string) => !validCategories.includes(cat as TaskCategory));
      if (invalidCategories.length > 0) {
        validation.isValid = false;
        validation.errors.push(`Invalid task categories: ${invalidCategories.join(', ')}`);
      }
    }
  }
  
  // Add warnings for recommendations
  if (!gameContext) {
    validation.warnings.push('gameContext not provided - tasks will be generic');
  }
  
  if (!options?.maxTasks) {
    validation.warnings.push('maxTasks not specified - using default value of 2');
  }
  
  res.json({
    success: true,
    data: validation
  });
});

/**
 * Health check for task generation service
 * GET /api/tasks/health
 */
export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  try {
    await initializeServices();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        taskGeneration: taskGenerationService ? 'active' : 'inactive',
        memory: memoryService ? 'active' : 'inactive'
      },
      version: '1.0.0'
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export all controller functions
export default {
  generateTasks,
  getPlayerTasks,
  updateTaskProgress,
  cancelTask,
  getTaskStats,
  getTaskTypes,
  validateTaskRequest,
  healthCheck
}; 