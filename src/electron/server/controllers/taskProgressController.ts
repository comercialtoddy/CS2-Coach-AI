/**
 * Task Progress Controller
 * 
 * Handles HTTP endpoints for the real-time task progress tracking system.
 * Provides APIs for monitoring task progress, getting tracking statistics, and managing the tracker.
 */

import { Request, Response } from 'express';
import { TaskProgressTracker, GameEvent, PlayerGameState } from '../services/taskProgressTracker.js';
import { TaskGenerationService } from '../services/taskGenerationServices.js';
import { MemoryService, createMemoryService } from '../ai/memory/MemoryService.js';
import { asyncHandler } from '../helpers/asyncHandler.js';

// Global service instances
let taskProgressTracker: TaskProgressTracker | null = null;
let taskGenerationService: TaskGenerationService | null = null;
let memoryService: MemoryService | null = null;

/**
 * Initialize the task progress tracking services
 */
async function initializeServices(): Promise<void> {
  if (!memoryService) {
    memoryService = await createMemoryService();
    await memoryService.initialize();
  }
  
  if (!taskGenerationService) {
    taskGenerationService = new TaskGenerationService(memoryService);
    console.log('✅ TaskGenerationService initialized for progress tracking');
  }
  
  if (!taskProgressTracker) {
    const { createTaskProgressTracker } = await import('../services/taskProgressTracker.js');
    taskProgressTracker = await createTaskProgressTracker(taskGenerationService, memoryService);
    console.log('✅ TaskProgressTracker initialized');
    
    // Setup event listeners for progress tracking
    setupProgressTrackerListeners();
  }
}

/**
 * Setup event listeners for the task progress tracker
 */
function setupProgressTrackerListeners(): void {
  if (!taskProgressTracker) return;

  taskProgressTracker.on('taskProgressUpdated', (data) => {
    console.log(`📊 Task progress updated for player ${data.playerId}: ${data.updates.length} tasks`);
  });

  taskProgressTracker.on('tasksCompleted', (data) => {
    console.log(`🏆 Tasks completed for player ${data.playerId}: ${data.completedTasks.length} tasks`);
  });

  taskProgressTracker.on('error', (data) => {
    console.error('❌ Task progress tracker error:', data.error);
  });

  taskProgressTracker.on('roundStart', (data) => {
    console.log(`🔄 Round ${data.roundNumber} started - resetting progress tracking`);
  });

  taskProgressTracker.on('roundEnd', (data) => {
    console.log(`🏁 Round ${data.roundNumber} ended - processing final events`);
  });
}

/**
 * Get task progress tracking statistics
 * GET /api/progress/stats
 */
export const getProgressStats = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  if (!taskProgressTracker) {
    return res.status(503).json({
      success: false,
      error: 'Task progress tracker not available'
    });
  }

  try {
    const stats = taskProgressTracker.getStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting progress stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get progress statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Manually trigger a game event for testing purposes
 * POST /api/progress/simulate-event
 */
export const simulateGameEvent = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId, eventType, eventData } = req.body;
  
  if (!steamId || !eventType) {
    return res.status(400).json({
      success: false,
      error: 'steamId and eventType are required'
    });
  }

  if (!taskProgressTracker) {
    return res.status(503).json({
      success: false,
      error: 'Task progress tracker not available'
    });
  }

  try {
    // Create a simulated game event
    const simulatedEvent: GameEvent = {
      type: eventType,
      data: eventData || {},
      timestamp: new Date(),
      playerId: steamId,
      roundNumber: 1,
      mapName: 'de_dust2',
      teamSide: 'CT'
    };

    // Process the event through the task generation service
    const updates = await taskGenerationService!.updateTaskProgress(steamId, simulatedEvent);

    res.json({
      success: true,
      data: {
        event: simulatedEvent,
        updates,
        totalUpdates: updates.length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error simulating game event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to simulate game event',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get player progress for all active tasks
 * GET /api/progress/player/:steamId
 */
export const getPlayerProgress = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.params;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    // Get active tasks for the player
    const activeTasks = await taskGenerationService!.getPlayerTasks(steamId);
    
    // Get tracking stats
    const trackingStats = taskProgressTracker?.getStats() || {};

    res.json({
      success: true,
      data: {
        steamId,
        activeTasks: activeTasks.filter(task => task.status === 'active'),
        totalActiveTasks: activeTasks.filter(task => task.status === 'active').length,
        trackingStats,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error getting player progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get player progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start the task progress tracker
 * POST /api/progress/start
 */
export const startTracker = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  if (!taskProgressTracker) {
    return res.status(503).json({
      success: false,
      error: 'Task progress tracker not available'
    });
  }

  try {
    taskProgressTracker.start();
    
    res.json({
      success: true,
      data: {
        status: 'started',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error starting tracker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start tracker',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Stop the task progress tracker
 * POST /api/progress/stop
 */
export const stopTracker = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  if (!taskProgressTracker) {
    return res.status(503).json({
      success: false,
      error: 'Task progress tracker not available'
    });
  }

  try {
    taskProgressTracker.stop();
    
    res.json({
      success: true,
      data: {
        status: 'stopped',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error stopping tracker:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop tracker',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for the task progress tracking system
 * GET /api/progress/health
 */
export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  try {
    await initializeServices();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        taskProgressTracker: taskProgressTracker ? 'active' : 'inactive',
        taskGeneration: taskGenerationService ? 'active' : 'inactive',
        memory: memoryService ? 'active' : 'inactive'
      },
      stats: taskProgressTracker?.getStats() || {},
      version: '1.0.0'
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('❌ Progress tracking health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test the complete task progress pipeline
 * POST /api/progress/test
 */
export const testProgressPipeline = asyncHandler(async (req: Request, res: Response) => {
  await initializeServices();
  
  const { steamId } = req.body;
  
  if (!steamId) {
    return res.status(400).json({
      success: false,
      error: 'steamId is required'
    });
  }

  try {
    console.log(`🧪 Testing task progress pipeline for player ${steamId}`);
    
    // Step 1: Generate tasks for the player
    const gameContext = {
      gameMode: 'competitive',
      mapName: 'de_dust2',
      teamSide: 'CT' as const,
      roundNumber: 1,
      economicState: 'buy',
      teamComposition: [],
      situationalFactors: []
    };
    
    const generatedTasks = await taskGenerationService!.generateTasksForPlayer(
      steamId,
      gameContext,
      { maxTasks: 2 }
    );
    
    // Step 2: Simulate some game events
    const testEvents = [
      { type: 'player_kill', data: { count: 1, weapon: 'ak47' } },
      { type: 'flash_assist', data: { count: 1 } },
      { type: 'bomb_plant', data: { site: 'A' } }
    ];
    
    const eventResults = [];
    for (const event of testEvents) {
      const gameEvent: GameEvent = {
        type: event.type,
        data: event.data,
        timestamp: new Date(),
        playerId: steamId,
        roundNumber: 1,
        mapName: 'de_dust2',
        teamSide: 'CT'
      };
      
      const updates = await taskGenerationService!.updateTaskProgress(steamId, gameEvent);
      eventResults.push({ event: gameEvent, updates });
    }
    
    // Step 3: Get final task status
    const finalTasks = await taskGenerationService!.getPlayerTasks(steamId);
    
    res.json({
      success: true,
      data: {
        testSummary: {
          steamId,
          tasksGenerated: generatedTasks.length,
          eventsProcessed: testEvents.length,
          totalUpdates: eventResults.reduce((sum, result) => sum + result.updates.length, 0)
        },
        generatedTasks,
        eventResults,
        finalTasks: finalTasks.filter(task => task.status === 'active'),
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error testing progress pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test progress pipeline',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export all controller functions
export default {
  getProgressStats,
  simulateGameEvent,
  getPlayerProgress,
  startTracker,
  stopTracker,
  healthCheck,
  testProgressPipeline
}; 