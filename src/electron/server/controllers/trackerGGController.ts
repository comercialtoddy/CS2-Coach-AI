import { Request, Response } from "express";
import {
  getTrackerGGPlayerStats,
  getPlayerSpecificStats,
  getTrackerGGRateLimitInfo,
  isTrackerGGConfigured,
  clearTrackerGGCache
} from "../services/trackerGGServices.js";

/**
 * GET /tracker-gg/player/:steamId
 * Fetches complete player statistics from Tracker.GG
 */
export const getPlayerStatsController = async (req: Request, res: Response) => {
  try {
    const { steamId } = req.params;
    const gameMode = (req.query.gameMode as 'csgo' | 'cs2') || 'cs2';

    if (!steamId) {
      return res.status(400).json({ error: 'Steam ID is required' });
    }

    if (!isTrackerGGConfigured()) {
      return res.status(503).json({ 
        error: 'Tracker.GG API not configured. Please set TRACKER_GG_API_KEY environment variable.' 
      });
    }

    const playerStats = await getTrackerGGPlayerStats(steamId, gameMode);
    
    res.status(200).json({
      success: true,
      data: playerStats,
      cached: false // You could enhance this to return if data was from cache
    });

  } catch (error: any) {
    console.error('Error fetching Tracker.GG player stats:', error);
    
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({ error: error.message });
    } else if (error.message.includes('Player not found')) {
      return res.status(404).json({ error: error.message });
    } else if (error.message.includes('Invalid Tracker.GG API key')) {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch player statistics',
      details: error.message 
    });
  }
};

/**
 * GET /tracker-gg/player/:steamId/stats
 * Fetches specific statistics for a player
 * Query params: stats (comma-separated list of stat names), gameMode
 */
export const getSpecificStatsController = async (req: Request, res: Response) => {
  try {
    const { steamId } = req.params;
    const { stats, gameMode = 'cs2' } = req.query;

    if (!steamId) {
      return res.status(400).json({ error: 'Steam ID is required' });
    }

    if (!stats || typeof stats !== 'string') {
      return res.status(400).json({ 
        error: 'Stats parameter is required. Provide comma-separated stat names (e.g., ?stats=kills,deaths,kdr)' 
      });
    }

    if (!isTrackerGGConfigured()) {
      return res.status(503).json({ 
        error: 'Tracker.GG API not configured. Please set TRACKER_GG_API_KEY environment variable.' 
      });
    }

    const statTypes = stats.split(',').map(s => s.trim().toLowerCase());
    const playerStats = await getPlayerSpecificStats(steamId, statTypes, gameMode as 'csgo' | 'cs2');
    
    res.status(200).json({
      success: true,
      data: playerStats,
      requestedStats: statTypes
    });

  } catch (error: any) {
    console.error('Error fetching specific Tracker.GG stats:', error);
    
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({ error: error.message });
    } else if (error.message.includes('Player not found')) {
      return res.status(404).json({ error: error.message });
    } else if (error.message.includes('Invalid Tracker.GG API key')) {
      return res.status(401).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch specific player statistics',
      details: error.message 
    });
  }
};

/**
 * GET /tracker-gg/rate-limit
 * Returns current rate limiting information
 */
export const getRateLimitController = async (req: Request, res: Response) => {
  try {
    const rateLimitInfo = getTrackerGGRateLimitInfo();
    
    res.status(200).json({
      success: true,
      data: {
        canMakeRequest: rateLimitInfo.canMakeRequest,
        timeUntilNextRequest: rateLimitInfo.timeUntilNext,
        requestsMadeInWindow: rateLimitInfo.requestsMade,
        isConfigured: isTrackerGGConfigured()
      }
    });

  } catch (error: any) {
    console.error('Error getting rate limit info:', error);
    res.status(500).json({ 
      error: 'Failed to get rate limit information',
      details: error.message 
    });
  }
};

/**
 * POST /tracker-gg/clear-cache
 * Clears the API cache
 */
export const clearCacheController = async (req: Request, res: Response) => {
  try {
    clearTrackerGGCache();
    
    res.status(200).json({
      success: true,
      message: 'Tracker.GG API cache cleared successfully'
    });

  } catch (error: any) {
    console.error('Error clearing Tracker.GG cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache',
      details: error.message 
    });
  }
};

/**
 * GET /tracker-gg/status
 * Returns the status of Tracker.GG API integration
 */
export const getStatusController = async (req: Request, res: Response) => {
  try {
    const rateLimitInfo = getTrackerGGRateLimitInfo();
    
    res.status(200).json({
      success: true,
      data: {
        configured: isTrackerGGConfigured(),
        rateLimiting: {
          canMakeRequest: rateLimitInfo.canMakeRequest,
          requestsMade: rateLimitInfo.requestsMade,
          timeUntilNext: rateLimitInfo.timeUntilNext
        },
        cacheEnabled: true,
        supportedGames: ['cs2', 'csgo']
      }
    });

  } catch (error: any) {
    console.error('Error getting Tracker.GG status:', error);
    res.status(500).json({ 
      error: 'Failed to get Tracker.GG status',
      details: error.message 
    });
  }
}; 