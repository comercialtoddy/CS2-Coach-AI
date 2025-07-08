import axios, { AxiosResponse } from 'axios';

// Tracker.GG API Configuration
const TRACKER_GG_BASE_URL = 'https://api.tracker.gg/v2';
const API_KEY = process.env.TRACKER_GG_API_KEY || '';

// Types for Tracker.GG API responses
export interface TrackerGGPlayerStats {
  platformInfo: {
    platformSlug: string;
    platformUserId: string;
    platformUserHandle: string;
  };
  userInfo: {
    userId: number;
    isPremium: boolean;
    isVerified: boolean;
    isInfluencer: boolean;
    isPartner: boolean;
    countryCode: string | null;
    customAvatarUrl: string | null;
    customHeroUrl: string | null;
  };
  metadata: {
    name: string;
  };
  segments: Array<{
    type: string;
    attributes: Record<string, any>;
    metadata: Record<string, any>;
    expiryDate: string;
    stats: Record<string, {
      rank: number | null;
      percentile: number | null;
      displayName: string;
      displayCategory: string;
      category: string;
      metadata: Record<string, any>;
      value: number;
      displayValue: string;
      displayType: string;
    }>;
  }>;
  availableSegments: Array<{
    type: string;
    attributes: Record<string, any>;
    metadata: Record<string, any>;
  }>;
  expiryDate: string;
}

// Rate limiting helpers
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number; // in milliseconds

  constructor(maxRequests: number = 100, timeWindowMinutes: number = 60) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMinutes * 60 * 1000;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getTimeUntilNextRequest(): number {
    if (this.canMakeRequest()) return 0;
    
    const oldestRequest = Math.min(...this.requests);
    return this.timeWindow - (Date.now() - oldestRequest);
  }
}

// Initialize rate limiter (100 requests per hour - conservative estimate)
const rateLimiter = new RateLimiter(100, 60);

// Cache for storing recent API responses
interface CacheEntry {
  data: TrackerGGPlayerStats;
  timestamp: number;
  expiryTime: number;
}

const apiCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Checks if API key is configured
 */
export function isTrackerGGConfigured(): boolean {
  return !!API_KEY && API_KEY !== '';
}

/**
 * Gets cached data if available and not expired
 */
function getCachedData(cacheKey: string): TrackerGGPlayerStats | null {
  const cached = apiCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now > cached.expiryTime) {
    apiCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

/**
 * Stores data in cache
 */
function setCachedData(cacheKey: string, data: TrackerGGPlayerStats): void {
  const now = Date.now();
  apiCache.set(cacheKey, {
    data,
    timestamp: now,
    expiryTime: now + CACHE_DURATION
  });
}

/**
 * Makes HTTP request to Tracker.GG API with proper headers and error handling
 */
async function makeTrackerGGRequest(endpoint: string): Promise<AxiosResponse<TrackerGGPlayerStats>> {
  if (!isTrackerGGConfigured()) {
    throw new Error('Tracker.GG API key not configured. Set TRACKER_GG_API_KEY environment variable.');
  }

  if (!rateLimiter.canMakeRequest()) {
    const waitTime = rateLimiter.getTimeUntilNextRequest();
    throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before making another request.`);
  }

  try {
    rateLimiter.recordRequest();
    
    const headers = {
      'TRN-Api-Key': API_KEY,
      'Accept': 'application/json',
      'User-Agent': 'CS2CoachAI/3.0.7'
    };

    const response = await axios.get<TrackerGGPlayerStats>(
      `${TRACKER_GG_BASE_URL}${endpoint}`,
      {
        headers,
        timeout: 10000 // 10 second timeout
      }
    );

    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded by Tracker.GG API');
      } else if (error.response?.status === 404) {
        throw new Error('Player not found on Tracker.GG');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid Tracker.GG API key or access denied');
      }
      throw new Error(`Tracker.GG API error: ${error.response?.status} - ${error.response?.statusText}`);
    }
    console.error('Network error occurred:', error);
    if (error instanceof Error) {
      throw new Error(`Network error when contacting Tracker.GG: ${error.message}`);
    }
    throw new Error('An unknown network error occurred when contacting Tracker.GG');
  }
}

/**
 * Fetches CS2/CSGO player statistics from Tracker.GG API
 * @param steamId - Steam ID of the player
 * @param gameMode - Game mode ('csgo' or 'cs2', defaults to 'cs2')
 */
export async function getTrackerGGPlayerStats(
  steamId: string, 
  gameMode: 'csgo' | 'cs2' = 'cs2'
): Promise<TrackerGGPlayerStats> {
  const cacheKey = `${gameMode}:${steamId}`;
  
  // Check cache first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log(`Returning cached Tracker.GG data for ${steamId}`);
    return cachedData;
  }

  // Make API request
  const endpoint = `/${gameMode}/standard/profile/steam/${steamId}`;
  console.log(`Fetching Tracker.GG stats for ${steamId} (${gameMode})`);
  
  const response = await makeTrackerGGRequest(endpoint);
  const playerStats = response.data;

  // Cache the response
  setCachedData(cacheKey, playerStats);

  return playerStats;
}

/**
 * Fetches specific statistics for a player
 * @param steamId - Steam ID of the player
 * @param statTypes - Array of stat types to retrieve (e.g., ['kills', 'deaths', 'kdr'])
 * @param gameMode - Game mode ('csgo' or 'cs2', defaults to 'cs2')
 */
export async function getPlayerSpecificStats(
  steamId: string,
  statTypes: string[],
  gameMode: 'csgo' | 'cs2' = 'cs2'
): Promise<Record<string, any>> {
  const playerStats = await getTrackerGGPlayerStats(steamId, gameMode);
  
  const result: Record<string, any> = {};
  
  // Extract requested stats from segments
  playerStats.segments.forEach(segment => {
    Object.entries(segment.stats).forEach(([statKey, statData]) => {
      if (statTypes.includes(statKey.toLowerCase())) {
        result[statKey] = {
          value: statData.value,
          displayValue: statData.displayValue,
          rank: statData.rank,
          percentile: statData.percentile
        };
      }
    });
  });

  return result;
}

/**
 * Gets rate limiting information
 */
export function getTrackerGGRateLimitInfo(): { canMakeRequest: boolean; timeUntilNext: number; requestsMade: number } {
  return {
    canMakeRequest: rateLimiter.canMakeRequest(),
    timeUntilNext: rateLimiter.getTimeUntilNextRequest(),
    requestsMade: rateLimiter['requests'].length // Access private property for debugging
  };
}

/**
 * Clears the API cache (useful for testing or manual refresh)
 */
export function clearTrackerGGCache(): void {
  apiCache.clear();
  console.log('Tracker.GG API cache cleared');
} 