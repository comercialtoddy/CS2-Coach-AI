import { Router } from "express";
import {
  getPlayerStatsController,
  getSpecificStatsController,
  getRateLimitController,
  clearCacheController,
  getStatusController,
} from "../controllers/trackerGGController.js";
import { asyncHandler } from "../helpers/asyncHandler.js";

export const trackerGGRoutes = Router();

// GET /tracker-gg/status - Check Tracker.GG API integration status
trackerGGRoutes.get("/status", asyncHandler(getStatusController));

// GET /tracker-gg/player/:steamId - Get complete player statistics
trackerGGRoutes.get("/player/:steamId", asyncHandler(getPlayerStatsController));

// GET /tracker-gg/player/:steamId/stats - Get specific player statistics
// Query params: stats (comma-separated), gameMode (cs2/csgo)
trackerGGRoutes.get(
  "/player/:steamId/stats",
  asyncHandler(getSpecificStatsController),
);

// GET /tracker-gg/rate-limit - Get current rate limiting information
trackerGGRoutes.get("/rate-limit", asyncHandler(getRateLimitController));

// POST /tracker-gg/clear-cache - Clear the API cache
trackerGGRoutes.post("/clear-cache", asyncHandler(clearCacheController));