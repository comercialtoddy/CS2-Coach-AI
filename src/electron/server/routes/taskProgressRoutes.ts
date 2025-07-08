/**
 * Task Progress Routes
 * 
 * Defines all HTTP routes for the real-time task progress tracking system.
 * Handles progress monitoring, statistics, and testing endpoints.
 */

import express from 'express';
import {
  getProgressStats,
  simulateGameEvent,
  getPlayerProgress,
  startTracker,
  stopTracker,
  healthCheck,
  testProgressPipeline
} from '../controllers/taskProgressController.js';

const router = express.Router();

// ===== Progress Monitoring Routes =====

/**
 * GET /api/progress/stats
 * Get task progress tracking statistics
 */
router.get('/stats', getProgressStats);

/**
 * GET /api/progress/player/:steamId
 * Get player progress for all active tasks
 */
router.get('/player/:steamId', getPlayerProgress);

/**
 * GET /api/progress/health
 * Health check for the task progress tracking system
 */
router.get('/health', healthCheck);

// ===== Tracker Management Routes =====

/**
 * POST /api/progress/start
 * Start the task progress tracker
 */
router.post('/start', startTracker);

/**
 * POST /api/progress/stop
 * Stop the task progress tracker
 */
router.post('/stop', stopTracker);

// ===== Testing and Simulation Routes =====

/**
 * POST /api/progress/simulate-event
 * Manually trigger a game event for testing purposes
 * 
 * Body:
 * {
 *   steamId: string,
 *   eventType: string,
 *   eventData?: object
 * }
 */
router.post('/simulate-event', simulateGameEvent);

/**
 * POST /api/progress/test
 * Test the complete task progress pipeline
 * 
 * Body:
 * {
 *   steamId: string
 * }
 */
router.post('/test', testProgressPipeline);

// ===== Information Route =====

/**
 * GET /api/progress/
 * Get basic information about the task progress tracking system
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Task Progress Tracking System',
      version: '1.0.0',
      description: 'Real-time task progress tracking integrated with CS2 Game State Integration',
      endpoints: {
        stats: 'GET /api/progress/stats',
        playerProgress: 'GET /api/progress/player/:steamId',
        health: 'GET /api/progress/health',
        start: 'POST /api/progress/start',
        stop: 'POST /api/progress/stop',
        simulateEvent: 'POST /api/progress/simulate-event',
        test: 'POST /api/progress/test'
      },
      capabilities: [
        'Real-time task progress tracking via GSI events',
        'Automatic task completion detection',
        'Player-specific progress monitoring',
        'Game event simulation for testing',
        'Comprehensive progress statistics',
        'Integration with task generation system'
      ],
      gameEvents: [
        'player_kill - Player eliminates an enemy',
        'player_assist - Player assists in a kill',
        'flash_assist - Player provides flash assistance',
        'utility_damage - Player deals damage with utilities',
        'bomb_plant - Player plants the bomb',
        'bomb_defuse - Player defuses the bomb',
        'money_save - Player saves money in eco round',
        'clutch_win - Player wins clutch situation',
        'multi_kill - Player gets multiple kills in round'
      ]
    }
  });
});

export default router; 