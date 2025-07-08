import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { 
  GetTrackerGGStatsInput, 
  GetTrackerGGStatsOutput, 
  TrackerGGStatType,
  TrackerGGPlayerStats,
  ToolError
} from '../interfaces/DataRetrievalTools.js';
import { 
  getTrackerGGPlayerStats, 
  getPlayerSpecificStats, 
  getTrackerGGRateLimitInfo, 
  isTrackerGGConfigured, 
  clearTrackerGGCache 
} from '../../services/trackerGGServices.js';
import { getPlayerBySteamId } from '../../services/playersServices.js';

/**
 * Tool_GetTrackerGGStats - Queries the Tracker.GG API for player statistics
 * 
 * This tool provides access to comprehensive CS:GO/CS2 player statistics from Tracker.GG,
 * including performance metrics, competitive rankings, and detailed gameplay statistics.
 * It integrates with the existing TrackerGG service with built-in rate limiting and caching.
 */
export class GetTrackerGGStatsTool implements ITool<GetTrackerGGStatsInput, GetTrackerGGStatsOutput> {
  
  readonly name = 'get-trackergg-stats';
  readonly description = 'Retrieves comprehensive CS:GO/CS2 player statistics from Tracker.GG API. Supports both general and specific stat retrieval with automatic rate limiting and caching. Requires player Steam ID and optional stat filtering.';
  
  readonly inputSchema: Record<string, ToolParameterSchema> = {
    playerId: {
      type: 'string',
      description: 'Steam ID of the player to retrieve statistics for. Can be a 64-bit Steam ID or player ID from the local database.',
      required: true
    },
    statTypes: {
      type: 'array',
      description: 'Optional array of specific stat types to retrieve. If not provided, returns all available stats. Valid options include: kills, deaths, kdr, adr, headshots, accuracy, rating, maps_played, rounds_played, wins, win_rate, damage_per_round, kills_per_round, assists, flash_assists, clutch_kills, entry_kills, multi_kills, bomb_planted, bomb_defused, knife_kills, grenade_kills, wallbang_kills, no_scope_kills, blind_kills, smoke_kills, through_smoke_kills, crouch_kills, jump_kills, reload_kills, team_kills, enemy_kills, damage_dealt, damage_taken, utility_damage, enemies_flashed, teammates_flashed, defuse_attempts, plant_attempts, mvp_rounds, first_kill_rounds, first_death_rounds, traded_kill_rounds, kast_rounds, survived_rounds, clutch_rounds, economy_rating, impact_rating',
      required: false,
      items: {
        type: 'string',
        description: 'A single stat type to retrieve.',
        enum: [
          'kills', 'deaths', 'kdr', 'adr', 'headshots', 'accuracy', 'rating',
          'maps_played', 'rounds_played', 'wins', 'win_rate', 'time_played',
          'damage_per_round', 'kills_per_round', 'assists', 'flash_assists',
          'clutch_kills', 'entry_kills', 'multi_kills', 'bomb_planted', 'bomb_defused',
          'knife_kills', 'grenade_kills', 'wallbang_kills', 'no_scope_kills',
          'blind_kills', 'smoke_kills', 'through_smoke_kills', 'crouch_kills',
          'jump_kills', 'reload_kills', 'team_kills', 'enemy_kills',
          'damage_dealt', 'damage_taken', 'utility_damage', 'enemies_flashed',
          'teammates_flashed', 'defuse_attempts', 'plant_attempts', 'mvp_rounds',
          'first_kill_rounds', 'first_death_rounds', 'traded_kill_rounds',
          'kast_rounds', 'survived_rounds', 'clutch_rounds', 'economy_rating', 'impact_rating'
        ]
      }
    },
    gameMode: {
      type: 'string',
      description: 'Game mode to retrieve stats for. Defaults to "cs2" for Counter-Strike 2.',
      required: false,
      enum: ['cs2', 'csgo'],
      default: 'cs2'
    },
    forceRefresh: {
      type: 'boolean',
      description: 'Whether to bypass cache and force a fresh API request. Use sparingly due to rate limits.',
      required: false,
      default: false
    },
    timeout: {
      type: 'number',
      description: 'Request timeout in milliseconds',
      required: false,
      default: 10000
    }
  };

  readonly outputExample: GetTrackerGGStatsOutput = {
    success: true,
    data: {
      playerId: '76561198041931474',
      playerName: 'ExamplePlayer',
      steamId: '76561198041931474',
      isPremium: false,
      isVerified: false,
      countryCode: 'US',
      avatarUrl: 'https://avatar.example.com/player.jpg',
      lastUpdated: '2023-12-07T10:30:00.000Z',
      stats: {
        kills: { value: 15420, displayValue: '15,420', rank: 25000, percentile: 85.5 },
        deaths: { value: 12350, displayValue: '12,350', rank: 20000, percentile: 78.2 },
        kdr: { value: 1.25, displayValue: '1.25', rank: 18500, percentile: 82.1 },
        adr: { value: 75.8, displayValue: '75.8', rank: 15000, percentile: 88.4 },
        headshots: { value: 6168, displayValue: '6,168', rank: 22000, percentile: 84.0 },
        accuracy: { value: 0.22, displayValue: '22%', rank: 19000, percentile: 80.5 },
        rating: { value: 1.15, displayValue: '1.15', rank: 17000, percentile: 86.2 },
        maps_played: { value: 500, displayValue: '500', rank: 10000, percentile: 90.1 },
        rounds_played: { value: 12500, displayValue: '12,500', rank: 11000, percentile: 89.5 },
        wins: { value: 275, displayValue: '275', rank: 9000, percentile: 91.3 },
        win_rate: { value: 0.55, displayValue: '55%', rank: 8000, percentile: 92.0 },
        time_played: { value: 1800000, displayValue: '500h', rank: null, percentile: null },
        damage_per_round: { value: 75.8, displayValue: '75.8', rank: 15000, percentile: 88.4 },
        kills_per_round: { value: 0.75, displayValue: '0.75', rank: 16000, percentile: 87.1 },
        assists: { value: 3000, displayValue: '3,000', rank: null, percentile: null },
        flash_assists: { value: 500, displayValue: '500', rank: null, percentile: null },
        clutch_kills: { value: 200, displayValue: '200', rank: null, percentile: null },
        entry_kills: { value: 1000, displayValue: '1,000', rank: null, percentile: null },
        multi_kills: { value: 1500, displayValue: '1,500', rank: null, percentile: null },
        bomb_planted: { value: 300, displayValue: '300', rank: null, percentile: null },
        bomb_defused: { value: 150, displayValue: '150', rank: null, percentile: null },
        knife_kills: { value: 50, displayValue: '50', rank: null, percentile: null },
        grenade_kills: { value: 100, displayValue: '100', rank: null, percentile: null },
        wallbang_kills: { value: 75, displayValue: '75', rank: null, percentile: null },
        no_scope_kills: { value: 25, displayValue: '25', rank: null, percentile: null },
        blind_kills: { value: 10, displayValue: '10', rank: null, percentile: null },
        smoke_kills: { value: 5, displayValue: '5', rank: null, percentile: null },
        through_smoke_kills: { value: 15, displayValue: '15', rank: null, percentile: null },
        crouch_kills: { value: 4000, displayValue: '4,000', rank: null, percentile: null },
        jump_kills: { value: 20, displayValue: '20', rank: null, percentile: null },
        reload_kills: { value: 1, displayValue: '1', rank: null, percentile: null },
        team_kills: { value: 100, displayValue: '100', rank: null, percentile: null },
        enemy_kills: { value: 15320, displayValue: '15,320', rank: null, percentile: null },
        damage_dealt: { value: 947500, displayValue: '947.5k', rank: null, percentile: null },
        damage_taken: { value: 890000, displayValue: '890k', rank: null, percentile: null },
        utility_damage: { value: 50000, displayValue: '50k', rank: null, percentile: null },
        enemies_flashed: { value: 2000, displayValue: '2,000', rank: null, percentile: null },
        teammates_flashed: { value: 200, displayValue: '200', rank: null, percentile: null },
        defuse_attempts: { value: 200, displayValue: '200', rank: null, percentile: null },
        plant_attempts: { value: 400, displayValue: '400', rank: null, percentile: null },
        mvp_rounds: { value: 400, displayValue: '400', rank: null, percentile: null },
        first_kill_rounds: { value: 800, displayValue: '800', rank: null, percentile: null },
        first_death_rounds: { value: 700, displayValue: '700', rank: null, percentile: null },
        traded_kill_rounds: { value: 600, displayValue: '600', rank: null, percentile: null },
        kast_rounds: { value: 0.72, displayValue: '72%', rank: null, percentile: null },
        survived_rounds: { value: 6000, displayValue: '6,000', rank: null, percentile: null },
        clutch_rounds: { value: 150, displayValue: '150', rank: null, percentile: null },
        economy_rating: { value: 1.1, displayValue: '1.1', rank: null, percentile: null },
        impact_rating: { value: 1.2, displayValue: '1.2', rank: null, percentile: null }
      },
      segments: [
        {
          type: 'overview',
          mode: 'competitive',
          stats: {
            kills: { value: 15420, displayValue: '15,420', rank: 25000, percentile: 85.5 },
            deaths: { value: 12350, displayValue: '12,350', rank: 20000, percentile: 78.2 }
          }
        }
      ]
    },
    timestamp: '2023-12-07T10:30:00.000Z',
    cached: false,
    rateLimitInfo: {
      canMakeRequest: true,
      timeUntilNext: 0,
      requestsMade: 15
    }
  };

  readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.EXTERNAL_API,
    tags: ['tracker-gg', 'player-stats', 'csgo', 'cs2', 'statistics', 'api'],
    author: 'OpenHud AI Framework',
    lastUpdated: new Date(),
    experimental: false
  };

  /**
   * Validates input parameters
   */
  validateInput(input: GetTrackerGGStatsInput): { isValid: boolean; errors?: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> } {
    const errors: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> = [];

    // Validate playerId
    if (!input.playerId || typeof input.playerId !== 'string') {
      errors.push({
        parameter: 'playerId',
        message: 'playerId is required and must be a string',
        receivedType: typeof input.playerId,
        expectedType: 'string'
      });
    } else if (input.playerId.trim().length === 0) {
      errors.push({
        parameter: 'playerId',
        message: 'playerId cannot be empty'
      });
    }

    // Validate statTypes if provided
    if (input.statTypes !== undefined) {
      if (!Array.isArray(input.statTypes)) {
        errors.push({
          parameter: 'statTypes',
          message: 'statTypes must be an array',
          receivedType: typeof input.statTypes,
          expectedType: 'array'
        });
      } else {
        const validStatTypes: TrackerGGStatType[] = [
          'kills', 'deaths', 'kdr', 'adr', 'headshots', 'accuracy', 'rating',
          'maps_played', 'rounds_played', 'wins', 'win_rate', 'time_played',
          'damage_per_round', 'kills_per_round', 'assists', 'flash_assists',
          'clutch_kills', 'entry_kills', 'multi_kills', 'bomb_planted', 'bomb_defused',
          'knife_kills', 'grenade_kills', 'wallbang_kills', 'no_scope_kills',
          'blind_kills', 'smoke_kills', 'through_smoke_kills', 'crouch_kills',
          'jump_kills', 'reload_kills', 'team_kills', 'enemy_kills',
          'damage_dealt', 'damage_taken', 'utility_damage', 'enemies_flashed',
          'teammates_flashed', 'defuse_attempts', 'plant_attempts', 'mvp_rounds',
          'first_kill_rounds', 'first_death_rounds', 'traded_kill_rounds',
          'kast_rounds', 'survived_rounds', 'clutch_rounds', 'economy_rating', 'impact_rating'
        ];

        for (const statType of input.statTypes) {
          if (!validStatTypes.includes(statType as TrackerGGStatType)) {
            errors.push({
              parameter: 'statTypes',
              message: `Invalid stat type: ${statType}. Valid options: ${validStatTypes.join(', ')}`
            });
          }
        }
      }
    }

    // Validate gameMode
    if (input.gameMode !== undefined && !['cs2', 'csgo'].includes(input.gameMode)) {
      errors.push({
        parameter: 'gameMode',
        message: 'gameMode must be either "cs2" or "csgo"',
        receivedType: typeof input.gameMode,
        expectedType: 'string'
      });
    }

    // Validate timeout
    if (input.timeout !== undefined && (typeof input.timeout !== 'number' || input.timeout < 0)) {
      errors.push({
        parameter: 'timeout',
        message: 'timeout must be a positive number',
        receivedType: typeof input.timeout,
        expectedType: 'number'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Main execution method
   */
  async execute(input: GetTrackerGGStatsInput, context: ToolExecutionContext): Promise<ToolExecutionResult<GetTrackerGGStatsOutput>> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Input validation failed',
            details: validation.errors
          },
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Check if TrackerGG is configured
      if (!isTrackerGGConfigured()) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Tracker.GG API key not configured. Set TRACKER_GG_API_KEY environment variable.',
            details: { service: 'tracker_gg', configuration: 'missing_api_key' }
          },
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Check rate limits
      const rateLimitInfo = getTrackerGGRateLimitInfo();
      if (!rateLimitInfo.canMakeRequest && !input.forceRefresh) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Next request available in ${Math.ceil(rateLimitInfo.timeUntilNext / 1000)} seconds.`,
            details: rateLimitInfo
          },
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Resolve player ID - check if it's a local player ID first
      let steamId = input.playerId;
      try {
        // If it's not a 64-bit Steam ID, try to find it in local database
        if (!/^\d{17}$/.test(input.playerId)) {
          const localPlayer = await getPlayerBySteamId(input.playerId) as any;
          if (localPlayer && localPlayer.steamid) {
            steamId = localPlayer.steamid;
          } else {
            // Try searching by player _id in database
            // This would require additional database query implementation
            steamId = input.playerId; // Fallback to original
          }
        }
      } catch (error) {
        console.warn('Failed to resolve player ID from local database:', error);
        // Continue with original playerId
      }

      // Clear cache if force refresh is requested
      if (input.forceRefresh) {
        clearTrackerGGCache();
      }

      // Get stats from TrackerGG
      let trackerStats;
      const gameMode = input.gameMode || 'cs2';
      
      try {
        if (input.statTypes && input.statTypes.length > 0) {
          // Get specific stats only
          const specificStats = await getPlayerSpecificStats(steamId, input.statTypes, gameMode);
          trackerStats = await getTrackerGGPlayerStats(steamId, gameMode);
          
          // Filter the response to only include requested stats
          const filteredStats: Partial<Record<TrackerGGStatType, any>> = {};
          for (const statType of input.statTypes) {
            if (specificStats[statType]) {
              filteredStats[statType] = specificStats[statType];
            }
          }
          
          // Convert to our expected format
          trackerStats = this.convertToStandardFormat(trackerStats, filteredStats);
        } else {
          // Get all available stats
          trackerStats = await getTrackerGGPlayerStats(steamId, gameMode);
          trackerStats = this.convertToStandardFormat(trackerStats);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Determine error type based on message
        let errorCode: ToolError = 'API_ERROR';
        if (errorMessage.includes('Rate limit')) {
          errorCode = 'RATE_LIMIT_EXCEEDED';
        } else if (errorMessage.includes('not found')) {
          errorCode = 'NOT_FOUND';
        } else if (errorMessage.includes('timeout')) {
          errorCode = 'TIMEOUT';
        } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
          errorCode = 'NETWORK_ERROR';
        }

        return {
          success: false,
          error: {
            code: errorCode,
            message: `Failed to retrieve TrackerGG stats: ${errorMessage}`,
            details: { steamId, gameMode, originalError: errorMessage }
          },
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Get updated rate limit info
      const updatedRateLimitInfo = getTrackerGGRateLimitInfo();

      const response: GetTrackerGGStatsOutput = {
        success: true,
        data: trackerStats,
        timestamp: new Date().toISOString(),
        cached: false, // The service handles caching internally
        rateLimitInfo: {
          canMakeRequest: updatedRateLimitInfo.canMakeRequest,
          timeUntilNext: updatedRateLimitInfo.timeUntilNext,
          requestsMade: updatedRateLimitInfo.requestsMade
        }
      };

      return {
        success: true,
        data: response,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: 'tracker_gg_api',
          networkRequests: 1,
          cached: false
        }
      };

    } catch (error) {
      console.error('Error executing GetTrackerGGStatsTool:', error);
      
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error while retrieving TrackerGG stats',
          details: error instanceof Error ? error.message : String(error)
        },
        metadata: {
          executionTimeMs: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string; details?: Record<string, any> }> {
    try {
      const isConfigured = isTrackerGGConfigured();
      const rateLimitInfo = getTrackerGGRateLimitInfo();
      
      if (!isConfigured) {
        return {
          healthy: false,
          message: 'TrackerGG API key not configured',
          details: {
            configured: false,
            reason: 'missing_api_key'
          }
        };
      }

      return {
        healthy: true,
        message: rateLimitInfo.canMakeRequest ? 'Service available' : 'Service available (rate limited)',
        details: {
          configured: true,
          rateLimitInfo,
          lastHealthCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check TrackerGG service status',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Convert TrackerGG API response to our standard format
   */
  private convertToStandardFormat(trackerGGResponse: any, filteredStats?: Record<string, any>): TrackerGGPlayerStats {
    const defaultStat = { value: 0, displayValue: '0', rank: null, percentile: null };
    const allStats: Record<TrackerGGStatType, any> = {
        kills: {...defaultStat}, deaths: {...defaultStat}, kdr: {...defaultStat}, adr: {...defaultStat}, headshots: {...defaultStat}, accuracy: {...defaultStat}, rating: {...defaultStat},
        maps_played: {...defaultStat}, rounds_played: {...defaultStat}, wins: {...defaultStat}, win_rate: {...defaultStat}, time_played: {...defaultStat},
        damage_per_round: {...defaultStat}, kills_per_round: {...defaultStat}, assists: {...defaultStat}, flash_assists: {...defaultStat},
        clutch_kills: {...defaultStat}, entry_kills: {...defaultStat}, multi_kills: {...defaultStat}, bomb_planted: {...defaultStat}, bomb_defused: {...defaultStat},
        knife_kills: {...defaultStat}, grenade_kills: {...defaultStat}, wallbang_kills: {...defaultStat}, no_scope_kills: {...defaultStat},
        blind_kills: {...defaultStat}, smoke_kills: {...defaultStat}, through_smoke_kills: {...defaultStat}, crouch_kills: {...defaultStat},
        jump_kills: {...defaultStat}, reload_kills: {...defaultStat}, team_kills: {...defaultStat}, enemy_kills: {...defaultStat},
        damage_dealt: {...defaultStat}, damage_taken: {...defaultStat}, utility_damage: {...defaultStat}, enemies_flashed: {...defaultStat},
        teammates_flashed: {...defaultStat}, defuse_attempts: {...defaultStat}, plant_attempts: {...defaultStat}, mvp_rounds: {...defaultStat},
        first_kill_rounds: {...defaultStat}, first_death_rounds: {...defaultStat}, traded_kill_rounds: {...defaultStat},
        kast_rounds: {...defaultStat}, survived_rounds: {...defaultStat}, clutch_rounds: {...defaultStat}, economy_rating: {...defaultStat}, impact_rating: {...defaultStat}
    };

    if (trackerGGResponse && trackerGGResponse.segments) {
        for (const segment of trackerGGResponse.segments) {
            if (segment.type === 'overview' && segment.stats) {
                for (const key in segment.stats) {
                    const normalizedKey = this.normalizeStatKey(key);
                    if (normalizedKey && allStats.hasOwnProperty(normalizedKey)) {
                        const stat = segment.stats[key];
                        allStats[normalizedKey as TrackerGGStatType] = {
                            value: stat.value ?? 0,
                            displayValue: stat.displayValue ?? String(stat.value ?? 0),
                            rank: stat.rank ?? null,
                            percentile: stat.percentile ?? null
              };
            }
                }
        }
        }
    }

    const finalStats = filteredStats ? 
        Object.fromEntries(Object.entries(allStats).filter(([key]) => filteredStats[key])) as Record<TrackerGGStatType, any>
        : allStats;

    return {
      playerId: trackerGGResponse?.platformInfo?.platformUserId ?? 'unknown',
      playerName: trackerGGResponse?.userInfo?.name ?? 'Unknown Player',
      steamId: trackerGGResponse?.platformInfo?.platformUserIdentifier ?? 'unknown',
      isPremium: trackerGGResponse?.userInfo?.isPremium ?? false,
      isVerified: trackerGGResponse?.userInfo?.isVerified ?? false,
      countryCode: trackerGGResponse?.userInfo?.countryCode ?? null,
      avatarUrl: trackerGGResponse?.userInfo?.customAvatarUrl ?? null,
      lastUpdated: trackerGGResponse?.expiryDate ?? new Date().toISOString(),
      stats: finalStats,
      segments: trackerGGResponse?.segments ?? []
    };
  }

  /**
   * Normalize stat keys from TrackerGG to our format
   */
  private normalizeStatKey(trackerKey: string): TrackerGGStatType | null {
    const keyMap: Record<string, TrackerGGStatType> = {
      'kills': 'kills',
      'deaths': 'deaths',
      'kd': 'kdr',
      'kdr': 'kdr',
      'adr': 'adr',
      'damagePerRound': 'damage_per_round',
      'headshots': 'headshots',
      'headshotPct': 'accuracy',
      'accuracy': 'accuracy',
      'rating': 'rating',
      'mapsPlayed': 'maps_played',
      'roundsPlayed': 'rounds_played',
      'wins': 'wins',
      'winPct': 'win_rate',
      'timePlayed': 'time_played',
      'assists': 'assists',
      'flashAssists': 'flash_assists',
      'clutchKills': 'clutch_kills',
      'entryKills': 'entry_kills',
      'multiKills': 'multi_kills',
      'bombsPlanted': 'bomb_planted',
      'bombsDefused': 'bomb_defused',
      'knifeKills': 'knife_kills',
      'grenadeKills': 'grenade_kills',
      'mvps': 'mvp_rounds',
      'firstKills': 'first_kill_rounds',
      'firstDeaths': 'first_death_rounds',
      'tradedKills': 'traded_kill_rounds',
      'kast': 'kast_rounds',
      'survivedRounds': 'survived_rounds',
      'clutchRounds': 'clutch_rounds'
    };

    return keyMap[trackerKey] || null;
  }
} 