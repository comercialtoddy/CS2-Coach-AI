/**
 * Reward Assignment Routes
 * 
 * Defines all HTTP routes for the reward assignment system.
 * Handles reward viewing, statistics, and testing endpoints.
 */

import express from 'express';
import {
  getPlayerRewards,
  getPlayerRewardStats,
  getSystemStats,
  healthCheck,
  testRewardPipeline
} from '../controllers/rewardAssignmentController.js';

const router = express.Router();

// ===== Reward Viewing Routes =====

/**
 * GET /api/rewards/player/:steamId
 * Get player's reward history
 */
router.get('/player/:steamId', getPlayerRewards);

/**
 * GET /api/rewards/player/:steamId/stats
 * Get player's reward statistics
 */
router.get('/player/:steamId/stats', getPlayerRewardStats);

/**
 * GET /api/rewards/stats
 * Get system-wide reward statistics
 */
router.get('/stats', getSystemStats);

/**
 * GET /api/rewards/health
 * Health check for the reward assignment system
 */
router.get('/health', healthCheck);

// ===== Testing Routes =====

/**
 * POST /api/rewards/test
 * Test the reward assignment pipeline
 * 
 * Body:
 * {
 *   steamId: string
 * }
 */
router.post('/test', testRewardPipeline);

// ===== Information Route =====

/**
 * GET /api/rewards/
 * Get basic information about the reward assignment system
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Reward Assignment System',
      version: '1.0.0',
      description: 'Dynamic reward system for task completion and achievements',
      endpoints: {
        playerRewards: 'GET /api/rewards/player/:steamId',
        playerStats: 'GET /api/rewards/player/:steamId/stats',
        systemStats: 'GET /api/rewards/stats',
        health: 'GET /api/rewards/health',
        test: 'POST /api/rewards/test'
      },
      capabilities: [
        'Dynamic reward calculation based on task difficulty',
        'Performance-based multipliers and bonuses',
        'Streak tracking and bonus rewards',
        'Player profile integration with XP and levels',
        'Comprehensive reward statistics',
        'Real-time reward assignment on task completion'
      ],
      rewardTypes: [
        'XP - Base experience points',
        'Achievement - Special accomplishments',
        'Insight - Gameplay insights and tips',
        'Bonus - Special event rewards'
      ],
      bonusTypes: [
        'First completion - First time completing a task type',
        'Improvement - Task targets player weakness',
        'Quick completion - Task completed quickly',
        'Streak - Consecutive task completions'
      ]
    }
  });
});

export default router; 