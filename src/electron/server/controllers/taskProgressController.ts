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
import { GSI } from '../sockets/GSI.js';
import { CSGO } from 'csgogsi';

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
    setupGSIListeners();
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
 * Setup GSI event listeners for real-time game events
 */
function setupGSIListeners(): void {
  if (!GSI) {
    console.error('❌ GSI not available for event processing');
    return;
  }

  // Listen for player kills
  GSI.on('kill', async (kill) => {
    if (!kill.killer || !kill.victim) return;

    const event: GameEvent = {
      type: 'player_kill',
      data: {
        killer: kill.killer.steamid,
        victim: kill.victim.steamid,
        weapon: kill.weapon,
        headshot: kill.headshot,
        wallbang: kill.wallbang,
        thrusmoke: kill.thrusmoke,
        attackerblind: kill.attackerblind
      },
      timestamp: new Date(),
      playerId: kill.killer.steamid,
      roundNumber: GSI.current?.map?.round || 0,
      mapName: GSI.current?.map?.name,
      teamSide: kill.killer.team.side
    };

    await processGameEvent(event);
  });

  // Note: GSI library doesn't have a direct 'assist' event
  // Assists are tracked through the kill event's assister property

  // Listen for bomb events
  GSI.on('bombPlant', async (player) => {
    if (!player) return;

    const event: GameEvent = {
      type: 'bomb_plant',
      data: {
        site: GSI.current?.bomb?.site || 'unknown',
        planter: player.steamid
      },
      timestamp: new Date(),
      playerId: player.steamid,
      roundNumber: GSI.current?.map?.round || 0,
      mapName: GSI.current?.map?.name,
      teamSide: 'T'
    };

    await processGameEvent(event);
  });

  GSI.on('bombDefuse', async (player) => {
    if (!player) return;

    const event: GameEvent = {
      type: 'bomb_defuse',
      data: {
        site: GSI.current?.bomb?.site || 'unknown',
        defuser: player.steamid,
        kit: player.state?.defusekit || false
      },
      timestamp: new Date(),
      playerId: player.steamid,
      roundNumber: GSI.current?.map?.round || 0,
      mapName: GSI.current?.map?.name,
      teamSide: 'CT'
    };

    await processGameEvent(event);
  });

  // Listen for round events
  GSI.on('roundStart', async () => {
    if (!GSI.current?.map) return;

    const event: GameEvent = {
      type: 'round_start',
      data: {
        phase: GSI.current.map.phase,
        round: GSI.current.map.round
      },
      timestamp: new Date(),
      playerId: GSI.current.player?.steamid || '',
      roundNumber: GSI.current.map.round,
      mapName: GSI.current.map.name
    };

    await processGameEvent(event);
  });

  GSI.on('roundEnd', async (score) => {
    if (!GSI.current?.map) return;

    const event: GameEvent = {
      type: 'round_end',
      data: {
        winner: score.winner.side,
        score_ct: score.map.team_ct.score,
        score_t: score.map.team_t.score,
        reason: score.map.round_wins?.[GSI.current.map.round]
      },
      timestamp: new Date(),
      playerId: GSI.current.player?.steamid || '',
      roundNumber: GSI.current.map.round,
      mapName: GSI.current.map.name
    };

    await processGameEvent(event);
  });

  // Listen for player state changes
  GSI.on('data', async (data: CSGO) => {
    if (!data.player || !data.map) return;

    // Process utility damage
    if (data.player.state?.round_totaldmg !== GSI.last?.player?.state?.round_totaldmg) {
      const event: GameEvent = {
        type: 'utility_damage',
        data: {
          damage: data.player.state?.round_totaldmg || 0,
          round_damage: data.player.state?.round_totaldmg || 0
        },
        timestamp: new Date(),
        playerId: data.player.steamid,
        roundNumber: data.map.round,
        mapName: data.map.name,
        teamSide: data.player.team.side
      };

      await processGameEvent(event);
    }

    // Process flash assists (using available properties)
    if (data.player.state?.round_kills !== GSI.last?.player?.state?.round_kills) {
      const event: GameEvent = {
        type: 'flash_assist',
        data: {
          count: data.player.state?.round_kills || 0,
          total: data.player.state?.round_kills || 0
        },
        timestamp: new Date(),
        playerId: data.player.steamid,
        roundNumber: data.map.round,
        mapName: data.map.name,
        teamSide: data.player.team.side
      };

      await processGameEvent(event);
    }
  });
}

/**
 * Process a real game event from GSI
 */
async function processGameEvent(event: GameEvent): Promise<void> {
  try {
    if (!taskGenerationService) {
      console.error('❌ TaskGenerationService not available for event processing');
      return;
    }

    console.log(`🎮 Processing game event: ${event.type} for player ${event.playerId}`);
    
    // Update task progress with real event
    const updates = await taskGenerationService.updateTaskProgress(event.playerId, event);
    
    if (updates.length > 0) {
      console.log(`✅ Updated ${updates.length} tasks for player ${event.playerId}`);
      
      // Emit progress update event
      taskProgressTracker?.emit('taskProgressUpdated', {
        playerId: event.playerId,
        event,
        updates
      });

      // Check for completed tasks
      const completedTasks = updates.filter(update => update.completed);
      if (completedTasks.length > 0) {
        console.log(`🏆 ${completedTasks.length} tasks completed for player ${event.playerId}`);
        taskProgressTracker?.emit('tasksCompleted', {
          playerId: event.playerId,
          completedTasks,
          event
        });
      }
    }
  } catch (error) {
    console.error('❌ Error processing game event:', error);
    taskProgressTracker?.emit('error', { error, event });
  }
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
        memory: memoryService ? 'active' : 'inactive',
        gsi: GSI ? 'active' : 'inactive'
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

// Export all controller functions
export default {
  getProgressStats,
  getPlayerProgress,
  startTracker,
  stopTracker,
  healthCheck
};