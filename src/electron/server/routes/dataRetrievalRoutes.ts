import express from "express";
import {
  getStatus,
  getGSIInfo,
  getTrackerGGStats,
  updatePlayerProfiles,
  getToolsInfo,
  testAllTools,
} from "../controllers/dataRetrievalController.js";
import { asyncHandler } from "../helpers/asyncHandler.js";

export const dataRetrievalRoutes = express.Router();

/**
 * Core Data Retrieval Tools API routes
 * Base path: /data-retrieval
 */

// GET /data-retrieval/status - Get service status and health checks
dataRetrievalRoutes.get("/status", asyncHandler(getStatus));

// GET /data-retrieval/tools/info - Get comprehensive tool information and examples
dataRetrievalRoutes.get("/tools/info", asyncHandler(getToolsInfo));

// POST /data-retrieval/test - Test all tools with sample data
dataRetrievalRoutes.post("/test", asyncHandler(testAllTools));

// POST /data-retrieval/gsi - Get GSI information from current game state
dataRetrievalRoutes.post("/gsi", asyncHandler(getGSIInfo));

// POST /data-retrieval/tracker-stats - Get TrackerGG statistics for a player
dataRetrievalRoutes.post("/tracker-stats", asyncHandler(getTrackerGGStats));

// POST /data-retrieval/update-profiles - Update player profiles in local database
dataRetrievalRoutes.post(
  "/update-profiles",
  asyncHandler(updatePlayerProfiles),
); 