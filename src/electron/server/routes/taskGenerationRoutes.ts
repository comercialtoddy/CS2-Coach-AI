/**
 * Task Generation Routes
 * 
 * Defines all HTTP routes for the dynamic task generation system.
 * Handles task creation, management, progress tracking, and statistics.
 */

import express from 'express';
import {
  generateTasks,
  getPlayerTasks,
  updateTaskProgress,
  cancelTask,
  getTaskStats,
  getTaskTypes,
  validateTaskRequest,
  healthCheck
} from '../controllers/taskGenerationController.js';

const router = express.Router();

// ===== Task Generation Routes =====

/**
 * POST /api/tasks/generate
 * Generate personalized tasks for a player
 * 
 * Body:
 * {
 *   steamId: string,
 *   gameContext?: {
 *     gameMode?: string,
 *     mapName?: string,
 *     teamSide?: 'CT' | 'T',
 *     roundNumber?: number,
 *     economicState?: string,
 *     teamComposition?: string[],
 *     situationalFactors?: string[]
 *   },
 *   options?: {
 *     maxTasks?: number,
 *     forceRefresh?: boolean,
 *     specificCategories?: string[]
 *   }
 * }
 */
router.post('/generate', generateTasks);

/**
 * GET /api/tasks/player/:steamId
 * Get active tasks for a specific player
 * 
 * Query params:
 * - status?: string (filter by task status)
 */
router.get('/player/:steamId', getPlayerTasks);

/**
 * POST /api/tasks/progress
 * Update task progress based on game events
 * 
 * Body:
 * {
 *   steamId: string,
 *   gameEvent: {
 *     type: string,
 *     data: object,
 *     timestamp?: string
 *   }
 * }
 */
router.post('/progress', updateTaskProgress);

/**
 * POST /api/tasks/:taskId/cancel
 * Cancel a specific task
 */
router.post('/:taskId/cancel', cancelTask);

// ===== Information and Configuration Routes =====

/**
 * GET /api/tasks/stats
 * Get task generation statistics
 */
router.get('/stats', getTaskStats);

/**
 * GET /api/tasks/types
 * Get available task categories, difficulties, and statuses
 */
router.get('/types', getTaskTypes);

/**
 * POST /api/tasks/validate
 * Validate a task generation request without executing it
 */
router.post('/validate', validateTaskRequest);

/**
 * GET /api/tasks/health
 * Health check for the task generation service
 */
router.get('/health', healthCheck);

// ===== Additional Utility Routes =====

/**
 * GET /api/tasks/
 * Get basic information about the task generation system
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Task Generation System',
      version: '1.0.0',
      description: 'Dynamic task generation for personalized CS2 coaching',
      endpoints: {
        generate: 'POST /api/tasks/generate',
        getPlayerTasks: 'GET /api/tasks/player/:steamId',
        updateProgress: 'POST /api/tasks/progress',
        cancelTask: 'POST /api/tasks/:taskId/cancel',
        stats: 'GET /api/tasks/stats',
        types: 'GET /api/tasks/types',
        validate: 'POST /api/tasks/validate',
        health: 'GET /api/tasks/health'
      },
      capabilities: [
        'Personalized task generation based on player profiles',
        'Real-time progress tracking via GSI events',
        'Adaptive difficulty and content based on player performance',
        'Multi-category task support (combat, utility, economy, objective, support)',
        'Task statistics and analytics',
        'Input validation and error handling'
      ]
    }
  });
});

export default router; 