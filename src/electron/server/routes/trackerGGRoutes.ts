import { Router } from "express";
import {
  getPlayerStatsController,
  getSpecificStatsController,
  getRateLimitController,
  clearCacheController,
  getStatusController
} from "../controllers/trackerGGController.js";

const router = Router();

// GET /tracker-gg/status - Check Tracker.GG API integration status
router.get("/status", getStatusController);

// GET /tracker-gg/player/:steamId - Get complete player statistics
router.get("/player/:steamId", getPlayerStatsController);

// GET /tracker-gg/player/:steamId/stats - Get specific player statistics
// Query params: stats (comma-separated), gameMode (cs2/csgo)
router.get("/player/:steamId/stats", getSpecificStatsController);

// GET /tracker-gg/rate-limit - Get current rate limiting information
router.get("/rate-limit", getRateLimitController);

// POST /tracker-gg/clear-cache - Clear the API cache
router.post("/clear-cache", clearCacheController);

export default router; 