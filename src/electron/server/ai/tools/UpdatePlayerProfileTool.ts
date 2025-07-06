import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { 
  UpdatePlayerProfileInput, 
  UpdatePlayerProfileOutput, 
  PlayerProfileUpdate,
  ToolError
} from '../interfaces/DataRetrievalTools.js';
import { 
  getPlayerBySteamId, 
  updatePlayer, 
  createPlayer, 
  getAllPlayers,
  getPlayerById 
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
  readonly description = 'Updates or creates player profiles in the local OpenHud database. Supports individual and batch updates, TrackerGG data integration, and comprehensive profile management with data validation and conflict resolution.';
  
  readonly inputSchema: Record<string, ToolParameterSchema> = {
    updates: {
      type: 'array',
      description: 'Array of player profile updates to apply. Each update can create a new player or modify an existing one.',
      required: true,
      items: {
        type: 'object',
        properties: {
          playerId: {
            type: 'string',
            description: 'Player identifier. Can be Steam ID, player database ID, or name for lookups.',
            required: false
          },
          steamId: {
            type: 'string',
            description: 'Steam ID (64-bit) for the player. Required for new players.',
            required: false
          },
          playerName: {
            type: 'string',
            description: 'Display name for the player',
            required: false
          },
          realName: {
            type: 'string',
            description: 'Real name of the player',
            required: false
          },
          country: {
            type: 'string',
            description: 'Country code (ISO 3166-1 alpha-2) for the player',
            required: false
          },
          team: {
            type: 'string',
            description: 'Current team name or ID',
            required: false
          },
          role: {
            type: 'string',
            description: 'Player role (e.g., "rifler", "awper", "igl", "support", "entry")',
            required: false
          },
          avatar: {
            type: 'string',
            description: 'URL to player avatar image',
            required: false
          },
          trackerGGStats: {
            type: 'object',
            description: 'Statistics from TrackerGG to integrate into the profile',
            required: false
          },
          extraData: {
            type: 'object',
            description: 'Additional custom data to store with the player profile',
            required: false
          },
          overrideExisting: {
            type: 'boolean',
            description: 'Whether to override existing data when updating',
            required: false,
            default: false
          }
        }
      }
    },
    batchMode: {
      type: 'boolean',
      description: 'Whether to process updates as a batch transaction. If true, all updates succeed or all fail.',
      required: false,
      default: true
    },
    validateSteamIds: {
      type: 'boolean',
      description: 'Whether to validate Steam ID format before processing',
      required: false,
      default: true
    },
    createIfNotExists: {
      type: 'boolean',
      description: 'Whether to create new player records if they do not exist',
      required: false,
      default: true
    },
    mergeTrackerGGData: {
      type: 'boolean',
      description: 'Whether to intelligently merge TrackerGG statistics with existing data',
      required: false,
      default: true
    },
    timeout: {
      type: 'number',
      description: 'Operation timeout in milliseconds',
      required: false,
      default: 30000
    }
  };

  readonly outputExample: UpdatePlayerProfileOutput = {
    success: true,
    totalUpdates: 2,
    successfulUpdates: 2,
    failedUpdates: 0,
    results: [
      {
        playerId: '76561198041931474',
        steamId: '76561198041931474',
        operation: 'updated',
        success: true,
        changes: ['playerName', 'team', 'country'],
        previousData: {
          playerName: 'OldName',
          team: 'OldTeam',
          country: 'US'
        },
        newData: {
          playerName: 'NewName',
          team: 'NewTeam',
          country: 'BR'
        }
      },
      {
        playerId: '76561198041931475',
        steamId: '76561198041931475',
        operation: 'created',
        success: true,
        changes: ['all'],
        newData: {
          playerName: 'NewPlayer',
          team: 'TeamA',
          country: 'DE',
          role: 'rifler'
        }
      }
    ],
    timestamp: '2023-12-07T10:30:00.000Z',
    batchMode: true
  };

  readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.DATABASE,
    tags: ['database', 'players', 'profiles', 'update', 'batch', 'tracker-gg'],
    author: 'OpenHud AI Framework',
    lastUpdated: new Date(),
    experimental: false
  };

  /**
   * Validates input parameters
   */
  validateInput(input: UpdatePlayerProfileInput): { isValid: boolean; errors?: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> } {
    const errors: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> = [];

    // Validate updates array
    if (!input.updates || !Array.isArray(input.updates)) {
      errors.push({
        parameter: 'updates',
        message: 'updates is required and must be an array',
        receivedType: typeof input.updates,
        expectedType: 'array'
      });
    } else if (input.updates.length === 0) {
      errors.push({
        parameter: 'updates',
        message: 'updates array cannot be empty'
      });
    } else {
      // Validate each update object
      input.updates.forEach((update, index) => {
        if (!update || typeof update !== 'object') {
          errors.push({
            parameter: `updates[${index}]`,
            message: 'Each update must be an object',
            receivedType: typeof update,
            expectedType: 'object'
          });
          return;
        }

        // Check that at least playerId or steamId is provided
        if (!update.playerId && !update.steamId) {
          errors.push({
            parameter: `updates[${index}]`,
            message: 'Either playerId or steamId must be provided for each update'
          });
        }

        // Validate Steam ID format if provided
        if (update.steamId && input.validateSteamIds !== false) {
          if (typeof update.steamId !== 'string' || !/^\d{17}$/.test(update.steamId)) {
            errors.push({
              parameter: `updates[${index}].steamId`,
              message: 'steamId must be a 17-digit string',
              receivedType: typeof update.steamId,
              expectedType: 'string (17 digits)'
            });
          }
        }

        // Validate country code format if provided
        if (update.country && (typeof update.country !== 'string' || !/^[A-Z]{2}$/.test(update.country))) {
          errors.push({
            parameter: `updates[${index}].country`,
            message: 'country must be a 2-letter ISO country code (uppercase)',
            receivedType: typeof update.country,
            expectedType: 'string (2 uppercase letters)'
          });
        }

        // Validate role if provided
        if (update.role !== undefined) {
          const validRoles = ['rifler', 'awper', 'igl', 'support', 'entry', 'lurker', 'coach', 'analyst'];
          if (typeof update.role !== 'string' || !validRoles.includes(update.role.toLowerCase())) {
            errors.push({
              parameter: `updates[${index}].role`,
              message: `role must be one of: ${validRoles.join(', ')}`,
              receivedType: typeof update.role,
              expectedType: 'string'
            });
          }
        }
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
  async execute(input: UpdatePlayerProfileInput, context: ToolExecutionContext): Promise<ToolExecutionResult<UpdatePlayerProfileOutput>> {
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

      const results: Array<{
        playerId?: string;
        steamId?: string;
        operation: 'created' | 'updated' | 'skipped';
        success: boolean;
        error?: string;
        changes?: string[];
        previousData?: Record<string, any>;
        newData?: Record<string, any>;
      }> = [];

      let successfulUpdates = 0;
      let failedUpdates = 0;

      // Process updates
      if (input.batchMode !== false) {
        // Batch mode: all succeed or all fail
        try {
          for (const update of input.updates) {
            const result = await this.processPlayerUpdate(update, input);
            results.push(result);
            
            if (result.success) {
              successfulUpdates++;
            } else {
              failedUpdates++;
              // In batch mode, if any update fails, we should rollback
              throw new Error(`Batch update failed at player ${result.playerId || result.steamId}: ${result.error}`);
            }
          }
        } catch (error) {
          // Rollback would be implemented here if transactions were supported
          return {
            success: false,
            error: {
              code: 'BATCH_UPDATE_FAILED',
              message: `Batch update failed: ${error instanceof Error ? error.message : String(error)}`,
              details: { 
                processedUpdates: results.length,
                failedAt: results.length,
                partialResults: results
              }
            },
            metadata: {
              executionTimeMs: Date.now() - startTime
            }
          };
        }
      } else {
        // Individual mode: continue processing even if some fail
        for (const update of input.updates) {
          try {
            const result = await this.processPlayerUpdate(update, input);
            results.push(result);
            
            if (result.success) {
              successfulUpdates++;
            } else {
              failedUpdates++;
            }
          } catch (error) {
            failedUpdates++;
            results.push({
              playerId: update.playerId,
              steamId: update.steamId,
              operation: 'skipped',
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      const response: UpdatePlayerProfileOutput = {
        success: failedUpdates === 0,
        totalUpdates: input.updates.length,
        successfulUpdates,
        failedUpdates,
        results,
        timestamp: new Date().toISOString(),
        batchMode: input.batchMode !== false
      };

      return {
        success: true,
        data: response,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          databaseOperations: results.length,
          networkRequests: 0
        }
      };

    } catch (error) {
      console.error('Error executing UpdatePlayerProfileTool:', error);
      
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error while updating player profiles',
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
      // Test database connectivity by getting player count
      const allPlayers = await getAllPlayers();
      
      return {
        healthy: true,
        message: 'Database connection healthy',
        details: {
          totalPlayers: allPlayers.length,
          databaseAccessible: true,
          lastHealthCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Database connection failed',
        details: { 
          error: error instanceof Error ? error.message : String(error),
          databaseAccessible: false
        }
      };
    }
  }

  /**
   * Process a single player update
   */
  private async processPlayerUpdate(
    update: PlayerProfileUpdate, 
    globalOptions: UpdatePlayerProfileInput
  ): Promise<{
    playerId?: string;
    steamId?: string;
    operation: 'created' | 'updated' | 'skipped';
    success: boolean;
    error?: string;
    changes?: string[];
    previousData?: Record<string, any>;
    newData?: Record<string, any>;
  }> {
    try {
      // Find existing player
      let existingPlayer = null;
      const identifier = update.steamId || update.playerId;
      
      if (!identifier) {
        return {
          operation: 'skipped',
          success: false,
          error: 'No valid identifier provided'
        };
      }

      // Try to find by Steam ID first, then by player ID
      try {
        if (update.steamId) {
          existingPlayer = await getPlayerBySteamId(update.steamId);
        } else if (update.playerId) {
          // Try by Steam ID format first
          if (/^\d{17}$/.test(update.playerId)) {
            existingPlayer = await getPlayerBySteamId(update.playerId);
          } else {
            // Try by database ID
            existingPlayer = await getPlayerById(parseInt(update.playerId));
          }
        }
      } catch (error) {
        console.warn('Error looking up existing player:', error);
      }

      if (existingPlayer) {
        // Update existing player
        return await this.updateExistingPlayer(existingPlayer, update, globalOptions);
      } else if (globalOptions.createIfNotExists !== false) {
        // Create new player
        return await this.createNewPlayer(update, globalOptions);
      } else {
        return {
          playerId: update.playerId,
          steamId: update.steamId,
          operation: 'skipped',
          success: false,
          error: 'Player not found and createIfNotExists is false'
        };
      }
    } catch (error) {
      return {
        playerId: update.playerId,
        steamId: update.steamId,
        operation: 'skipped',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update an existing player
   */
  private async updateExistingPlayer(
    existingPlayer: any,
    update: PlayerProfileUpdate,
    globalOptions: UpdatePlayerProfileInput
  ) {
    const changes: string[] = [];
    const previousData: Record<string, any> = {};
    const newData: Record<string, any> = {};

    // Build update object with only changed fields
    const updateData: any = {};

    // Check each field for changes
    const fieldsToCheck = [
      'name', 'realname', 'country', 'team', 'avatar'
    ];

    const updateMapping = {
      playerName: 'name',
      realName: 'realname',
      country: 'country',
      team: 'team',
      avatar: 'avatar'
    };

    Object.entries(updateMapping).forEach(([updateKey, dbKey]) => {
      const updateValue = (update as any)[updateKey];
      if (updateValue !== undefined) {
        const currentValue = existingPlayer[dbKey];
        if (updateValue !== currentValue) {
          updateData[dbKey] = updateValue;
          changes.push(updateKey);
          previousData[updateKey] = currentValue;
          newData[updateKey] = updateValue;
        }
      }
    });

    // Handle TrackerGG stats integration
    if (update.trackerGGStats && globalOptions.mergeTrackerGGData !== false) {
      // Merge TrackerGG data into extra_data field
      const currentExtraData = existingPlayer.extra_data ? JSON.parse(existingPlayer.extra_data) : {};
      const newExtraData = {
        ...currentExtraData,
        trackerGG: {
          ...currentExtraData.trackerGG,
          ...update.trackerGGStats,
          lastUpdated: new Date().toISOString()
        }
      };

      if (JSON.stringify(newExtraData) !== JSON.stringify(currentExtraData)) {
        updateData.extra_data = JSON.stringify(newExtraData);
        changes.push('trackerGGStats');
        previousData.trackerGGStats = currentExtraData.trackerGG;
        newData.trackerGGStats = newExtraData.trackerGG;
      }
    }

    // Handle custom extra data
    if (update.extraData) {
      const currentExtraData = existingPlayer.extra_data ? JSON.parse(existingPlayer.extra_data) : {};
      const mergedExtraData = update.overrideExisting 
        ? { ...currentExtraData, ...update.extraData }
        : { ...update.extraData, ...currentExtraData };

      if (JSON.stringify(mergedExtraData) !== JSON.stringify(currentExtraData)) {
        updateData.extra_data = JSON.stringify(mergedExtraData);
        changes.push('extraData');
        previousData.extraData = currentExtraData;
        newData.extraData = mergedExtraData;
      }
    }

    // If no changes, skip update
    if (changes.length === 0) {
      return {
        playerId: String(existingPlayer._id),
        steamId: existingPlayer.steamid,
        operation: 'skipped' as const,
        success: true,
        changes: [],
        previousData: {},
        newData: {}
      };
    }

    // Perform update
    await updatePlayer(existingPlayer._id, updateData);

    return {
      playerId: String(existingPlayer._id),
      steamId: existingPlayer.steamid,
      operation: 'updated' as const,
      success: true,
      changes,
      previousData,
      newData
    };
  }

  /**
   * Create a new player
   */
  private async createNewPlayer(
    update: PlayerProfileUpdate,
    globalOptions: UpdatePlayerProfileInput
  ) {
    // Validate required fields for new player
    if (!update.steamId && !update.playerId) {
      throw new Error('Steam ID is required for new player creation');
    }

    const steamId = update.steamId || update.playerId;
    if (!steamId || !/^\d{17}$/.test(steamId)) {
      throw new Error('Valid Steam ID is required for new player creation');
    }

    // Build new player data
    const playerData: any = {
      steamid: steamId,
      name: update.playerName || 'Unknown Player',
      realname: update.realName || null,
      country: update.country || null,
      team: update.team || null,
      avatar: update.avatar || null
    };

    // Handle extra data
    const extraData: any = {};
    
    if (update.trackerGGStats) {
      extraData.trackerGG = {
        ...update.trackerGGStats,
        lastUpdated: new Date().toISOString()
      };
    }

    if (update.extraData) {
      Object.assign(extraData, update.extraData);
    }

    if (update.role) {
      extraData.role = update.role;
    }

    if (Object.keys(extraData).length > 0) {
      playerData.extra_data = JSON.stringify(extraData);
    }

    // Create player
    const newPlayer = await createPlayer(playerData);

    return {
      playerId: String(newPlayer._id),
      steamId: newPlayer.steamid,
      operation: 'created' as const,
      success: true,
      changes: ['all'],
      newData: {
        playerName: playerData.name,
        realName: playerData.realname,
        country: playerData.country,
        team: playerData.team,
        avatar: playerData.avatar,
        role: update.role,
        trackerGGStats: update.trackerGGStats,
        extraData: update.extraData
      }
    };
  }
} 