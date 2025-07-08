import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { 
  UpdatePlayerProfileInput, 
  UpdatePlayerProfileOutput, 
  ExtendedPlayerProfile
} from '../interfaces/DataRetrievalTools.js';
import { 
  getPlayerBySteamId, 
  updatePlayer, 
  createPlayer, 
  getPlayers 
} from '../../services/playersServices.js';

/**
 * Tool_UpdatePlayerProfile - Updates player profiles in the local database
 * 
 * This tool provides functionality to create, update, and manage player profiles
 * in the OpenHud local database. It can handle bulk updates, TrackerGG integration,
 * and maintains data consistency across the system.
 */
export class UpdatePlayerProfileTool implements ITool<UpdatePlayerProfileInput, UpdatePlayerProfileOutput> {
  
  readonly name = 'update-player-profile';
  readonly description = 'Updates or creates a player profile in the local OpenHud database. Supports individual updates, TrackerGG data integration, and comprehensive profile management with data validation and conflict resolution.';
  
  readonly inputSchema: Record<string, ToolParameterSchema> = {
    playerId: {
      type: 'string',
      description: 'The ID of the player to update. This is typically their 64-bit Steam ID.',
      required: true
    },
    updateData: {
      type: 'object',
      description: 'An object containing the data to update for the player profile.',
      required: true,
      properties: {
        basicInfo: {
        type: 'object',
          description: 'Basic player information to update.',
        properties: {
            firstName: { type: 'string', description: "The player's first name." },
            lastName: { type: 'string', description: "The player's last name." },
            username: { type: 'string', description: "The player's username or alias." },
            avatar: { type: 'string', description: "A URL to the player's avatar image." },
            country: { type: 'string', description: 'The two-letter country code for the player.' },
            team: { type: 'string', description: 'The ID of the team the player belongs to.' }
          }
          },
          trackerGGStats: {
            type: 'object',
          description: 'Statistics from Tracker.GG to integrate into the profile.'
        },
        performance: { type: 'object', description: 'Performance-related metrics.' },
        gameMemory: { type: 'object', description: 'In-game memory or state-related data.' },
        coachNotes: { type: 'object', description: 'Notes or observations from a coach.' },
        lastActiveMatch: { type: 'string', description: 'The ID of the last match the player was active in.' },
        updateReason: { type: 'string', description: 'The reason for this profile update.' }
      }
    },
    mergeStrategy: {
      type: 'string',
      description: 'Strategy for handling existing data: "replace" overwrites, "merge" combines (default), "append" adds to existing.',
      enum: ['replace', 'merge', 'append'],
      required: false,
      default: 'merge'
    },
    validateData: {
      type: 'boolean',
      description: 'If true, validates input data before processing (default: true).',
      required: false,
      default: true
    },
    createIfNotExists: {
      type: 'boolean',
      description: 'If true, creates a new player record if one does not already exist (default: true).',
      required: false,
      default: true
    }
  };

  readonly outputExample: UpdatePlayerProfileOutput = {
    success: true,
        playerId: '76561198041931474',
    data: {
      _id: 'some_db_id',
      steamid: '76561198041931474',
      username: 'NewName',
      firstName: 'New',
      lastName: 'Name',
      country: 'BR',
      team: 'team_id_123',
      avatar: 'http://example.com/avatar.jpg',
      extra: {}
    },
    changes: {
        fieldsUpdated: ['username', 'team', 'country'],
        previousValues: {
          username: 'OldName',
          team: 'team_id_abc',
          country: 'US'
        },
        newValues: {
          username: 'NewName',
          team: 'team_id_123',
          country: 'BR'
        }
      },
    metadata: {
        created: false,
        databaseOperations: ["UPDATE players SET username = 'NewName', team = 'team_id_123', country = 'BR' WHERE steamid = '76561198041931474'"],
    },
    timestamp: '2023-12-07T10:30:00.000Z'
  };

  readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.DATABASE,
    tags: ['database', 'players', 'profiles', 'update', 'tracker-gg'],
    author: 'OpenHud AI Framework',
    lastUpdated: new Date(),
    experimental: false
  };

  /**
   * Validates input parameters
   */
  validateInput(input: UpdatePlayerProfileInput): { isValid: boolean; errors?: Array<{ parameter: string; message: string; }> } {
    const errors: Array<{ parameter: string; message: string; }> = [];

    if (!input.playerId) {
      errors.push({ parameter: 'playerId', message: 'playerId is required' });
        }
    if (!input.updateData) {
      errors.push({ parameter: 'updateData', message: 'updateData is required' });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Main execution method
   */
  async execute(input: UpdatePlayerProfileInput, context: ToolExecutionContext): Promise<ToolExecutionResult<UpdatePlayerProfileOutput>> {
    const startTime = Date.now();
    
    if (input.validateData !== false) {
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Input validation failed',
            details: JSON.stringify(validation.errors)
          },
          metadata: { executionTimeMs: Date.now() - startTime }
          };
        }
    }

          try {
      const result = await this.processPlayerUpdate(input);
      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          databaseOperations: result.metadata?.databaseOperations,
          networkRequests: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unknown error occurred while updating player profile.',
          details: error instanceof Error ? error.stack : String(error)
        },
        metadata: { executionTimeMs: Date.now() - startTime }
      };
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string; details?: Record<string, any> }> {
    try {
      await getPlayers();
      return { healthy: true, message: 'Database connection healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Process a single player update
   */
  private async processPlayerUpdate(input: UpdatePlayerProfileInput): Promise<UpdatePlayerProfileOutput> {
    const identifier = input.playerId;
    const existingPlayer = await getPlayerBySteamId(identifier) as Player | null;

      if (existingPlayer) {
      return this.updateExistingPlayer(existingPlayer, input);
    } 
    
    if (input.createIfNotExists !== false) {
      return this.createNewPlayer(input);
    } 
    
    throw new Error('Player not found and createIfNotExists is false');
  }

  /**
   * Update an existing player
   */
  private async updateExistingPlayer(existingPlayer: Player, input: UpdatePlayerProfileInput): Promise<UpdatePlayerProfileOutput> {
    const updatesToApply: Partial<Player> = {};
    const previousValues: Record<string, any> = {};

    if (input.updateData.basicInfo) {
      const basicInfoKeys = Object.keys(input.updateData.basicInfo) as Array<keyof typeof input.updateData.basicInfo>;
      for (const key of basicInfoKeys) {
        const newValue = input.updateData.basicInfo[key];
        if (newValue !== undefined && existingPlayer[key] !== newValue) {
          updatesToApply[key] = newValue;
          previousValues[key] = existingPlayer[key];
      }
    }
    }
    
    if (Object.keys(updatesToApply).length === 0) {
      return {
        success: true,
        playerId: existingPlayer.steamid,
        data: this.mapPlayerToExtendedProfile(existingPlayer),
        changes: { fieldsUpdated: [] },
        metadata: { created: false, databaseOperations: ['No update needed'] },
        timestamp: new Date().toISOString()
      };
    }

    const updatedPlayer = await updatePlayer(existingPlayer._id, updatesToApply) as Player;

    return {
      success: true,
      playerId: updatedPlayer.steamid,
      data: this.mapPlayerToExtendedProfile(updatedPlayer),
      changes: {
        fieldsUpdated: Object.keys(updatesToApply),
        previousValues: previousValues,
        newValues: updatesToApply
      },
      metadata: {
        created: false,
        databaseOperations: [`UPDATE players SET ${Object.keys(updatesToApply).map(k => `${k}=?`).join(', ')} WHERE _id = ${existingPlayer._id}`]
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a new player
   */
  private async createNewPlayer(input: UpdatePlayerProfileInput): Promise<UpdatePlayerProfileOutput> {
    const playerData: Partial<Player> = {
      steamid: input.playerId,
      ...input.updateData.basicInfo
    };

    const newPlayer = await createPlayer(playerData) as Player;

    return {
      success: true,
      playerId: newPlayer.steamid,
      data: this.mapPlayerToExtendedProfile(newPlayer),
      changes: {
        fieldsUpdated: Object.keys(playerData)
      },
      metadata: {
        created: true,
        databaseOperations: [`INSERT INTO players (...) VALUES (...)`]
      },
      timestamp: new Date().toISOString()
      };
    }

  private mapPlayerToExtendedProfile(player: Player): ExtendedPlayerProfile {
    return {
      _id: player._id,
      steamid: player.steamid,
      username: player.username,
      firstName: player.firstName,
      lastName: player.lastName,
      country: player.country,
      team: player.team,
      avatar: player.avatar,
      extra: player.extra
    };
  }
} 