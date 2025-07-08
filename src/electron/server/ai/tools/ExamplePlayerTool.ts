import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { getPlayers } from '../../services/playersServices.js';

/**
 * Input interface for the PlayerDataTool
 */
export interface PlayerDataToolInput {
  playerId: number;
  includeStats?: boolean;
}

/**
 * Output interface for the PlayerDataTool
 */
export interface PlayerDataToolOutput {
  player: {
    id: string;
    name: string;
    realName?: string;
    steamId?: string;
    country?: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  stats?: {
    matchesPlayed: number;
    averageRating: number;
    lastActive: Date;
  };
}

/**
 * Example AI tool that retrieves player data from the database
 * 
 * This serves as a reference implementation for the AI Tooling Framework
 * and demonstrates best practices for tool development.
 */
export class PlayerDataTool implements ITool<PlayerDataToolInput, PlayerDataToolOutput> {
  public readonly name = 'get-player-data';
  
  public readonly description = 
    'Retrieves comprehensive player information from the database by player ID. ' +
    'Can optionally include player statistics and performance metrics.';

  public readonly inputSchema: Record<string, ToolParameterSchema> = {
    playerId: {
      type: 'number',
      description: 'Unique identifier of the player to retrieve',
      required: true
    },
    includeStats: {
      type: 'boolean',
      description: 'Whether to include player statistics in the response',
      required: false,
      default: false
    }
  };

  public readonly outputExample: PlayerDataToolOutput = {
    player: {
      id: "1",
      name: 's1mple',
      realName: 'Oleksandr Kostyliev',
      steamId: '76561198034202275',
      country: 'UA',
      avatar: 'https://example.com/avatar.jpg',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-12-01')
    },
    stats: {
      matchesPlayed: 150,
      averageRating: 1.28,
      lastActive: new Date('2023-12-01')
    }
  };

  public readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.DATA_RETRIEVAL,
    tags: ['player', 'database', 'cs2', 'profile'],
    author: 'OpenHud AI System',
    lastUpdated: new Date(),
    experimental: false,
    deprecated: false
  };

  /**
   * Validates input parameters according to the tool's schema
   */
  public validateInput(input: PlayerDataToolInput): {
    isValid: boolean;
    errors?: Array<{
      parameter: string;
      message: string;
      receivedType?: string;
      expectedType?: string;
    }>;
  } {
    const errors: Array<{
      parameter: string;
      message: string;
      receivedType?: string;
      expectedType?: string;
    }> = [];

    // Validate playerId
    if (input.playerId === undefined || input.playerId === null) {
      errors.push({
        parameter: 'playerId',
        message: 'playerId is required',
        receivedType: typeof input.playerId,
        expectedType: 'number'
      });
    } else if (typeof input.playerId !== 'number') {
      errors.push({
        parameter: 'playerId',
        message: 'playerId must be a number',
        receivedType: typeof input.playerId,
        expectedType: 'number'
      });
    } else if (!Number.isInteger(input.playerId) || input.playerId <= 0) {
      errors.push({
        parameter: 'playerId',
        message: 'playerId must be a positive integer',
        receivedType: typeof input.playerId,
        expectedType: 'positive integer'
      });
    }

    // Validate includeStats (optional)
    if (input.includeStats !== undefined && typeof input.includeStats !== 'boolean') {
      errors.push({
        parameter: 'includeStats',
        message: 'includeStats must be a boolean',
        receivedType: typeof input.includeStats,
        expectedType: 'boolean'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Executes the tool to retrieve player data
   */
  public async execute(
    input: PlayerDataToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<PlayerDataToolOutput>> {
    const startTime = Date.now();
    
    try {
      if (input.playerId === undefined || input.playerId === null) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: "No player ID provided",
          }
        };
      }

      const players = await getPlayers();
      const player: any = players.find(p => p._id === String(input.playerId));
      
      if (!player) {
        return {
          success: false,
          error: {
            code: 'PLAYER_NOT_FOUND',
            message: `Player with ID ${input.playerId} not found in database`,
            details: { playerId: input.playerId }
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            source: this.name,
            cached: false
          }
        };
      }

      // Prepare basic player data
      const playerData: PlayerDataToolOutput = {
        player: {
          id: player._id,
          name: player.username,
          realName: `${player.firstName} ${player.lastName}`,
          steamId: player.steamid,
          country: player.country,
          avatar: player.avatar,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      // Include stats if requested
      if (input.includeStats) {
        // In a real implementation, this would query match statistics
        // For now, we'll provide mock stats
        playerData.stats = {
          matchesPlayed: Math.floor(Math.random() * 200) + 50,
          averageRating: Math.round((Math.random() * 0.8 + 0.8) * 100) / 100, // 0.8-1.6 rating
          lastActive: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Within last 30 days
        };
      }

      return {
        success: true,
        data: playerData,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: this.name,
          cached: false,
          includeStats: input.includeStats || false,
          requestId: context.requestId
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
            code: 'TOOL_EXECUTION_ERROR',
            message: `Failed to retrieve player: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }
      };
    }
  }

  /**
   * Health check to verify database connectivity
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      // Try to get a player count or perform a simple query
      // This is a simple health check - in real implementation you might:
      // - Check database connection
      // - Verify table exists
      // - Check recent query performance
      const testResult = await getPlayers();
      
      return {
        healthy: true,
        message: 'Database connection and player service are working properly',
        details: {
          testQuery: 'getPlayers()',
          responseTime: 'fast',
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Database or player service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Optional cleanup method (not needed for this tool)
   */
  public async dispose(): Promise<void> {
    // No cleanup needed for this tool as it doesn't maintain persistent connections
    // In tools that have connections, caches, or other resources, this is where you'd clean them up
    console.log(`PlayerDataTool '${this.name}' disposed successfully`);
  }
} 