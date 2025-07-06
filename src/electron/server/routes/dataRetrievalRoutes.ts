import { Router } from 'express';
import {
  getStatus,
  getGSIInfo,
  getTrackerGGStats,
  updatePlayerProfiles,
  getToolsInfo,
  testAllTools
} from '../controllers/dataRetrievalController.js';

const router = Router();

/**
 * Core Data Retrieval Tools API routes
 * Base path: /data-retrieval
 */

// GET /data-retrieval/status - Get service status and health checks
router.get('/status', getStatus);

// GET /data-retrieval/tools/info - Get comprehensive tool information and examples
router.get('/tools/info', getToolsInfo);

// POST /data-retrieval/test - Test all tools with sample data
router.post('/test', testAllTools);

// POST /data-retrieval/gsi - Get GSI information from current game state
router.post('/gsi', getGSIInfo);

// POST /data-retrieval/tracker-stats - Get TrackerGG statistics for a player
router.post('/tracker-stats', getTrackerGGStats);

// POST /data-retrieval/update-profiles - Update player profiles in local database
router.post('/update-profiles', updatePlayerProfiles);

export default router; 