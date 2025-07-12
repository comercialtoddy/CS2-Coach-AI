import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { 
  GetGSIInfoInput, 
  GetGSIInfoOutput, 
  GSIDataPoint, 
  GSIData,
  GSIPlayerState,
  GSIPlayerMatchStats,
  GSIPlayerWeapons,
  GSITeamState,
  GSIMapInfo,
  GSIRoundInfo,
  GSIAllPlayersInfo,
  ToolError
} from '../interfaces/DataRetrievalTools.js';
import { GSI } from '../../sockets/GSI.js';
import { CSGO, Map, Player, Round, Bomb, Side, Team } from 'csgogsi';

/**
 * Tool_GetGSIInfo - Retrieves specific GSI data points from the current normalized GSI state
 * 
 * This tool provides access to Counter-Strike: Global Offensive Game State Integration data
 * through the existing csgogsi library integration. It can retrieve various game state 
 * information including player stats, team states, map information, and real-time game data.
 */
export class GetGSIInfoTool implements ITool<GetGSIInfoInput, GetGSIInfoOutput> {
  
  readonly name = 'get-gsi-info';
  readonly description = 'Retrieves specific data points from the current CS:GO/CS2 Game State Integration (GSI) system. Can fetch player statistics, team states, map information, round details, and other real-time game data.';
  
  readonly inputSchema: Record<string, ToolParameterSchema> = {
    dataPoints: {
      type: 'array',
      description: 'Array of specific GSI data points to retrieve. Valid options: player_state, player_match_stats, player_weapons, team_state, map_info, round_info, all_players, spectator_info, game_phase, bomb_info, grenade_info',
      required: true,
      items: {
        type: 'string',
        description: 'A single GSI data point to retrieve.',
        enum: [
          'player_state',
          'player_match_stats', 
          'player_weapons',
          'team_state',
          'map_info',
          'round_info',
          'all_players',
          'spectator_info',
          'game_phase',
          'bomb_info',
          'grenade_info'
        ]
      }
    },
    includeMetadata: {
      type: 'boolean',
      description: 'Whether to include metadata about the GSI connection and data freshness',
      required: false,
      default: true
    },
    steamId: {
      type: 'string',
      description: 'Steam ID for player-specific data. If not provided, uses the currently observed player',
      required: false
    },
    timeout: {
      type: 'number',
      description: 'Request timeout in milliseconds',
      required: false,
      default: 5000
    }
  };

  readonly outputExample: GetGSIInfoOutput = {
    success: true,
    data: {
      playerState: {
        health: 100,
        armor: 100,
        helmet: true,
        money: 2500,
        roundKills: 1,
        roundKillsHeadshot: 0,
        roundTotalDamage: 87,
        equipValue: 4750,
        defusekit: false
      },
      mapInfo: {
        name: 'de_dust2',
        phase: 'live',
        round: 5,
        teamCT: {
          score: 3,
          timeoutsRemaining: 4,
          matchesWonThisSeries: 0,
          side: 'CT',
          consecutiveRoundLosses: 0
        },
        teamT: {
          score: 2,
          timeoutsRemaining: 4,
          matchesWonThisSeries: 0,
          side: 'T',
          consecutiveRoundLosses: 1
        }
      }
    },
    timestamp: '2023-12-07T10:30:00.000Z',
    dataPoints: ['player_state', 'map_info'],
    metadata: {
      gameActive: true,
      lastUpdate: '2023-12-07T10:29:58.000Z',
      dataFreshness: 2000
    }
  };

  readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.GAME_STATE,
    tags: ['gsi', 'game-state', 'csgo', 'cs2', 'real-time', 'player-stats'],
    author: 'OpenHud AI Framework',
    lastUpdated: new Date(),
    experimental: false
  };

  /**
   * Validates input parameters
   */
  validateInput(input: GetGSIInfoInput): { isValid: boolean; errors?: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> } {
    const errors: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> = [];

    // Validate dataPoints
    if (!input.dataPoints || !Array.isArray(input.dataPoints)) {
      errors.push({
        parameter: 'dataPoints',
        message: 'dataPoints is required and must be an array',
        receivedType: typeof input.dataPoints,
        expectedType: 'array'
      });
    } else if (input.dataPoints.length === 0) {
      errors.push({
        parameter: 'dataPoints',
        message: 'dataPoints array cannot be empty'
      });
    } else {
      const validDataPoints: GSIDataPoint[] = [
        'player_state', 'player_match_stats', 'player_weapons', 'team_state',
        'map_info', 'round_info', 'all_players', 'spectator_info', 
        'game_phase', 'bomb_info', 'grenade_info'
      ];
      
      for (const dataPoint of input.dataPoints) {
        if (!validDataPoints.includes(dataPoint as GSIDataPoint)) {
          errors.push({
            parameter: 'dataPoints',
            message: `Invalid data point: ${dataPoint}. Valid options: ${validDataPoints.join(', ')}`
          });
        }
      }
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

    // Validate steamId
    if (input.steamId !== undefined && typeof input.steamId !== 'string') {
      errors.push({
        parameter: 'steamId',
        message: 'steamId must be a string',
        receivedType: typeof input.steamId,
        expectedType: 'string'
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
  async execute(input: GetGSIInfoInput, context: ToolExecutionContext): Promise<ToolExecutionResult<GetGSIInfoOutput>> {
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

      // Get current GSI data
      const currentGSI: CSGO | undefined = GSI.current;
      
      if (!currentGSI) {
        return {
          success: false,
          error: {
            code: 'MISSING_DATA',
            message: 'No GSI data available. Game may not be running or GSI not configured.',
            details: { gsiState: 'not_available' }
          },
          metadata: {
            executionTimeMs: Date.now() - startTime
          }
        };
      }

      // Build response data based on requested data points
      const gsiData: GSIData = {};
      const missingDataPoints: GSIDataPoint[] = [];

      for (const dataPoint of input.dataPoints) {
        try {
          switch (dataPoint) {
            case 'player_state':
              gsiData.playerState = this.extractPlayerState(currentGSI, input.steamId);
              break;
              
            case 'player_match_stats':
              gsiData.playerMatchStats = this.extractPlayerMatchStats(currentGSI, input.steamId);
              break;
              
            case 'player_weapons':
              gsiData.playerWeapons = this.extractPlayerWeapons(currentGSI, input.steamId);
              break;
              
            case 'team_state':
              gsiData.teamState = this.extractTeamState(currentGSI);
              break;
              
            case 'map_info':
              gsiData.mapInfo = this.extractMapInfo(currentGSI);
              break;
              
            case 'round_info':
              gsiData.roundInfo = this.extractRoundInfo(currentGSI);
              break;
              
            case 'all_players':
              gsiData.allPlayers = this.extractAllPlayersInfo(currentGSI);
              break;
              
            case 'spectator_info':
              gsiData.spectatorInfo = this.extractSpectatorInfo(currentGSI);
              break;
              
            case 'game_phase':
              gsiData.gamePhase = this.extractGamePhase(currentGSI);
              break;
              
            case 'bomb_info':
              gsiData.bombInfo = this.extractBombInfo(currentGSI);
              break;
              
            case 'grenade_info':
              gsiData.grenadeInfo = this.extractGrenadeInfo(currentGSI);
              break;
              
            default:
              missingDataPoints.push(dataPoint);
          }
        } catch (error) {
          // Log error for debugging but don't include in missing data points
          console.error(`Failed to extract GSI data point ${dataPoint}:`, error);
          missingDataPoints.push(dataPoint);
        }
      }

      // Build metadata if requested
      let metadata;
      if (input.includeMetadata !== false) {
        metadata = {
          gameActive: !!currentGSI && !!currentGSI.map,
          lastUpdate: new Date().toISOString(),
          dataFreshness: 0, // Real-time data
          missingDataPoints: missingDataPoints.length > 0 ? missingDataPoints : undefined
        };
      }

      const response: GetGSIInfoOutput = {
        success: true,
        data: gsiData,
        timestamp: new Date().toISOString(),
        dataPoints: input.dataPoints,
        metadata
      };

      return {
        success: true,
        data: response,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: 'csgogsi_library'
        }
      };

    } catch (error) {
      console.error('Error executing GetGSIInfoTool:', error);
      
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error while retrieving GSI data',
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
      const currentGSI = GSI.current;
      
      return {
        healthy: true,
        message: currentGSI ? 'GSI data available' : 'GSI not active (game not running)',
        details: {
          gsiAvailable: !!currentGSI,
          hasMapData: !!currentGSI?.map,
          hasPlayerData: !!currentGSI?.player,
          lastDataCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check GSI status',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Private helper methods for data extraction

  private extractPlayerState(gsi: CSGO, steamId?: string): GSIPlayerState | undefined {
    const player = this.getTargetPlayer(gsi, steamId);
    if (!player?.state) return undefined;

    return {
      health: player.state.health ?? 0,
      armor: player.state.armor ?? 0,
      helmet: player.state.helmet ?? false,
      money: player.state.money ?? 0,
      roundKills: player.state.round_kills ?? 0,
      roundKillsHeadshot: player.state.round_killhs ?? 0,
      roundTotalDamage: player.state.round_totaldmg ?? 0,
      equipValue: player.state.equip_value ?? 0,
      defusekit: player.state.defusekit ?? false,
      flashed: player.state.flashed,
      burning: player.state.burning,
      smoked: player.state.smoked
    };
  }

  private extractPlayerMatchStats(gsi: CSGO, steamId?: string): GSIPlayerMatchStats | undefined {
    const player = this.getTargetPlayer(gsi, steamId);
    if (!player) return undefined;

    return {
      kills: player.stats.kills ?? 0,
      assists: player.stats.assists ?? 0,
      deaths: player.stats.deaths ?? 0,
      mvps: player.stats.mvps ?? 0,
      score: player.stats.score ?? 0,
      headshots: player.state.round_killhs ?? 0,
      totalDamage: player.state.round_totaldmg ?? 0
    };
  }

  private extractPlayerWeapons(gsi: CSGO, steamId?: string): GSIPlayerWeapons | undefined {
    const player = this.getTargetPlayer(gsi, steamId);
    if (!player?.weapons) return undefined;

    const weapons: GSIPlayerWeapons = {};

    Object.entries(player.weapons).forEach(([slot, weapon]) => {
      if (!weapon) return;

      const weaponData = {
        name: weapon.name ?? 'unknown',
        paintkit: weapon.paintkit ?? 'default',
        type: weapon.type ?? 'unknown',
        ammoClip: weapon.ammo_clip ?? 0,
        ammoReserve: weapon.ammo_reserve ?? 0,
        state: weapon.state ?? 'unknown'
      };

      switch (weapon.type) {
        case 'Rifle':
        case 'SniperRifle':
        case 'Shotgun':
        case 'Machine Gun':
          weapons.primary = weaponData;
          break;
        case 'Pistol':
          weapons.secondary = weaponData;
          break;
        case 'Knife':
          weapons.knife = {
            name: weapon.name ?? 'unknown',
            paintkit: weapon.paintkit ?? 'default',
            type: weapon.type ?? 'unknown',
            state: weapon.state ?? 'unknown'
          };
          break;
        case 'Grenade':
          if (!weapons.grenades) weapons.grenades = [];
          weapons.grenades.push({
            name: weapon.name ?? 'unknown',
            type: weapon.type ?? 'unknown',
            state: weapon.state ?? 'unknown'
          });
          break;
        case 'C4':
          weapons.c4 = {
            name: weapon.name ?? 'unknown',
            type: weapon.type ?? 'unknown',
            state: weapon.state ?? 'unknown'
          };
          break;
      }
    });

    return weapons;
  }

  private extractTeamState(gsi: CSGO): {CT: GSITeamState, T: GSITeamState} | undefined {
    if (!gsi.map?.team_ct || !gsi.map?.team_t) return undefined;

    const transform = (team: Team): GSITeamState => ({
      score: team.score,
      timeoutsRemaining: team.timeouts_remaining,
      matchesWonThisSeries: team.matches_won_this_series,
      side: team.side as ('CT' | 'T'),
      consecutiveRoundLosses: team.consecutive_round_losses,
      name: team.name ?? undefined,
      id: team.id ?? undefined,
      logo: team.logo ?? undefined
    });

    return {
      CT: transform(gsi.map.team_ct),
      T: transform(gsi.map.team_t)
    };
  }

  private extractMapInfo(gsi: CSGO): GSIMapInfo | undefined {
    if (!gsi.map) return undefined;

    return {
      name: gsi.map.name ?? 'unknown',
      phase: gsi.map.phase ?? 'unknown',
      round: gsi.map.round ?? 0,
      teamCT: {
        score: gsi.map.team_ct.score ?? 0,
        timeoutsRemaining: gsi.map.team_ct.timeouts_remaining ?? 0,
        matchesWonThisSeries: gsi.map.team_ct.matches_won_this_series ?? 0,
        side: 'CT',
        consecutiveRoundLosses: gsi.map.team_ct.consecutive_round_losses ?? 0,
        name: gsi.map.team_ct.name ?? undefined,
        id: gsi.map.team_ct.id ?? undefined,
        logo: gsi.map.team_ct.logo ?? undefined
      },
      teamT: {
        score: gsi.map.team_t.score ?? 0,
        timeoutsRemaining: gsi.map.team_t.timeouts_remaining ?? 0,
        matchesWonThisSeries: gsi.map.team_t.matches_won_this_series ?? 0,
        side: 'T',
        consecutiveRoundLosses: gsi.map.team_t.consecutive_round_losses ?? 0,
        name: gsi.map.team_t.name ?? undefined,
        id: gsi.map.team_t.id ?? undefined,
        logo: gsi.map.team_t.logo ?? undefined
      },
      currentSpectatorTarget: gsi.player?.steamid,
      roundWins: gsi.map.round_wins
    };
  }

  private extractRoundInfo(gsi: CSGO): GSIRoundInfo | undefined {
    if (!gsi.round) return undefined;
    return {
      phase: gsi.round.phase,
      winTeam: gsi.round.win_team,
      bombPlanted: gsi.round.bomb === 'planted',
      bombTimeLeft: gsi.bomb?.countdown,
      bombSite: gsi.bomb?.site ?? undefined,
      bombDefuser: gsi.bomb?.player?.steamid,
      bombPlanter: gsi.bomb?.player?.steamid
    };
  }

  private extractAllPlayersInfo(gsi: CSGO): GSIAllPlayersInfo | undefined {
    if (!gsi.players) return undefined;
    const allPlayers: GSIAllPlayersInfo = {};
    for(const player of gsi.players){
        if(!player.steamid) continue;
      allPlayers[player.steamid] = {
        name: player.name ?? 'unknown',
        observerSlot: player.observer_slot ?? 0,
            team: player.team.side,
        state: this.extractPlayerState(gsi, player.steamid) ?? {
          health: 0,
          armor: 0,
          helmet: false,
          money: 0,
          roundKills: 0,
          roundKillsHeadshot: 0,
          roundTotalDamage: 0,
              equipValue: 0,
              defusekit: false
        },
        matchStats: this.extractPlayerMatchStats(gsi, player.steamid) ?? {
          kills: 0,
          assists: 0,
          deaths: 0,
          mvps: 0,
          score: 0,
          headshots: 0,
          totalDamage: 0
        },
        weapons: this.extractPlayerWeapons(gsi, player.steamid) ?? {},
            position: player.position.join(','),
            forward: player.forward.join(',')
        }
    }
    return allPlayers;
  }

  private extractSpectatorInfo(gsi: CSGO): { target: string; slot: number; mode: string } | undefined {
    const player = gsi.player;
    if (!player) return undefined;

    return {
      target: player.steamid,
      slot: player.observer_slot ?? 0,
      mode: player.state.health > 0 ? 'alive' : 'dead'
    };
  }

  private extractGamePhase(gsi: CSGO): string | undefined {
    return gsi.map?.phase;
  }

  private extractBombInfo(gsi: CSGO): { planted: boolean; timeLeft?: number; site?: string; defuser?: string; planter?: string } | undefined {
    if (!gsi.bomb) return undefined;
    return {
      planted: gsi.bomb.state !== 'carried' && gsi.bomb.state !== 'dropped',
      timeLeft: gsi.bomb.countdown,
      site: gsi.bomb.site ?? undefined,
      defuser: gsi.bomb.player?.steamid,
      planter: gsi.bomb.player?.steamid
    };
  }

  private extractGrenadeInfo(gsi: CSGO): Array<{ id: string; type: string; position: string; velocity: string; lifetime: number; effecttime: number }> | undefined {
    // Note: Grenade info requires special GSI configuration and may not always be available
    // This would typically come from gsi.grenades but the csgogsi library might not expose this directly
    return undefined; // Implementation depends on library capabilities
  }

  private getTargetPlayer(gsi: CSGO, steamId?: string) {
    if (steamId) {
      return gsi.players?.find(p => p.steamid === steamId);
    }
    return gsi.player;
  }
} 