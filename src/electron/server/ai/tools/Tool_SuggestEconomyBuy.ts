import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata } from '../interfaces/ITool.js';
import { GSIDataModel } from '../orchestrator/GSITypes.js';
import { BuyStrategyType, getRecommendedBuyStrategy } from './economyRules.js';
import { PlayerRole, getAdvancedBuyRecommendations } from './advancedEconomyRules.js';

interface GSIPlayer {
  team: string;
  state?: {
    money?: number;
    equip_value?: number;
  };
  observer_slot?: number;
  weapons?: Record<string, GSIWeapon>;
  position?: string;
}

interface GSIWeapon {
  name: string;
}

interface EconomyBuyInput {
  gsiData: GSIDataModel;
  playerId: string;
  playerRole?: PlayerRole;
}

interface EconomyBuyOutput {
  strategy: BuyStrategyType;
  recommendations: {
    primary?: string;
    secondary?: string;
    armor: boolean;
    helmet: boolean;
    defuseKit?: boolean;
    grenades: {
      flashbang: number;
      smoke: number;
      he: number;
      molotov: number;
      decoy: number;
    };
  };
  reasoning: string;
  opponentEconomyStatus?: string;
}

/**
 * Tool for suggesting optimal equipment purchases based on economy analysis
 */
export class Tool_SuggestEconomyBuy implements ITool<EconomyBuyInput, EconomyBuyOutput> {
  public name = 'Tool_SuggestEconomyBuy';
  public description = 'Suggests optimal equipment purchases based on player money, team economy, and game state.';

  public inputSchema: Record<string, ToolParameterSchema> = {
    gsiData: {
      type: 'object',
      description: 'Game State Integration data',
      required: true
    },
    playerId: {
      type: 'string',
      description: 'ID of the player to analyze',
      required: true
    },
    playerRole: {
      type: 'string',
      description: 'Optional player role override',
      required: false,
      enum: Object.values(PlayerRole)
    }
  };

  public outputExample: EconomyBuyOutput = {
    strategy: BuyStrategyType.FULL_BUY,
    recommendations: {
      primary: 'AK47',
      secondary: undefined,
      armor: true,
      helmet: true,
      grenades: {
        flashbang: 2,
        smoke: 1,
        he: 1,
        molotov: 1,
        decoy: 0
      }
    },
    reasoning: 'Full buy recommended with $4700 as ENTRY. Team has good economy with average of $5000.',
    opponentEconomyStatus: 'Opponent average equipment: $500, Money: $3500'
  };

  public metadata: ToolMetadata = {
    version: '1.0.0',
    category: 'economy',
    tags: ['cs2', 'economy', 'buy-recommendations']
  };

  public validateInput(input: EconomyBuyInput): { isValid: boolean; errors?: { parameter: string; message: string; receivedType?: string; expectedType?: string; }[] } {
    const errors = [];

    if (!input.gsiData) {
      errors.push({
        parameter: 'gsiData',
        message: 'GSI data is required',
        receivedType: typeof input.gsiData,
        expectedType: 'object'
      });
    }

    if (!input.playerId) {
      errors.push({
        parameter: 'playerId',
        message: 'Player ID is required',
        receivedType: typeof input.playerId,
        expectedType: 'string'
      });
    }

    if (input.playerRole && !Object.values(PlayerRole).includes(input.playerRole)) {
      errors.push({
        parameter: 'playerRole',
        message: 'Invalid player role',
        receivedType: input.playerRole,
        expectedType: Object.values(PlayerRole).join(' | ')
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get player's team from GSI data
   */
  private getPlayerTeam(gsiData: GSIDataModel, playerId: string): 'CT' | 'T' | null {
    const player = gsiData.allplayers?.[playerId];
    if (!player) return null;
    return player.team === 'CT' ? 'CT' : 'T';
  }

  /**
   * Get player's current money
   */
  private getPlayerMoney(gsiData: GSIDataModel, playerId: string): number {
    return gsiData.allplayers?.[playerId]?.state?.money || 0;
  }

  /**
   * Calculate team's average money
   */
  private getTeamAverageMoney(gsiData: GSIDataModel, team: 'CT' | 'T'): number {
    const teamPlayers = Object.values(gsiData.allplayers || {}) as GSIPlayer[];
    const filteredPlayers = teamPlayers.filter(p => p.team === team);
    if (filteredPlayers.length === 0) return 0;

    const totalMoney = filteredPlayers.reduce((sum, player) => sum + (player.state?.money || 0), 0);
    return totalMoney / filteredPlayers.length;
  }

  /**
   * Calculate current loss bonus
   */
  private getLossBonus(gsiData: GSIDataModel, team: 'CT' | 'T'): number {
    // Get the last few rounds
    const rounds = gsiData.map?.round_wins || [];
    if (rounds.length === 0) return 0;

    // Count consecutive losses
    let consecutiveLosses = 0;
    for (let i = rounds.length - 1; i >= 0 && i > rounds.length - 6; i--) {
      if (rounds[i] !== team) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    // Map consecutive losses to loss bonus
    switch (consecutiveLosses) {
      case 0: return 1900;
      case 1: return 2400;
      case 2: return 2900;
      case 3: return 3400;
      default: return 3400;
    }
  }

  /**
   * Check if it's the first round of a half
   */
  private isFirstRound(gsiData: GSIDataModel): boolean {
    return (gsiData.map?.round || 1) === 1 || (gsiData.map?.round || 1) === 16;
  }

  /**
   * Determine player's role based on their typical positions and equipment preferences
   */
  private inferPlayerRole(gsiData: GSIDataModel, playerId: string): PlayerRole {
    const player = gsiData.allplayers?.[playerId] as GSIPlayer | undefined;
    if (!player) return PlayerRole.SUPPORT; // Default to SUPPORT if player not found

    // Check if player is the team leader (IGL)
    const isLeader = player.observer_slot === 0; // Usually slot 0 is IGL
    if (isLeader) return PlayerRole.IGL;

    // Check recent weapon purchases to determine role
    const weapons = player.weapons || {};
    const hasAWP = Object.values(weapons).some((w: GSIWeapon) => w.name === 'weapon_awp');
    if (hasAWP) return PlayerRole.AWP;

    // Check player's typical position
    const position = player.position || '';
    const isLurk = position.toLowerCase().includes('lurk');
    if (isLurk) return PlayerRole.LURK;

    // Default to ENTRY if no other role is determined
    return PlayerRole.ENTRY;
  }

  /**
   * Generate reasoning for the buy recommendation
   */
  private generateReasoning(
    strategy: BuyStrategyType,
    playerMoney: number,
    teamAverageMoney: number,
    lossBonus: number,
    isFirstRound: boolean,
    playerRole: PlayerRole,
    opponentStrategy?: BuyStrategyType
  ): string {
    let reasoning = '';

    if (isFirstRound) {
      reasoning = `First round of the half - pistol round strategy recommended for ${playerRole} role.`;
    } else {
      switch (strategy) {
        case BuyStrategyType.FULL_BUY:
          reasoning = `Full buy recommended with $${playerMoney} as ${playerRole}. Team has good economy with average of $${Math.round(teamAverageMoney)}.`;
          break;
        
        case BuyStrategyType.FORCE_BUY:
          reasoning = `Force buy recommended with $${playerMoney} as ${playerRole}. Loss bonus at $${lossBonus} makes this a good opportunity to pressure the opponent.`;
          break;
        
        case BuyStrategyType.SEMI_BUY:
          reasoning = `Semi-buy recommended with $${playerMoney} as ${playerRole}. This allows for basic equipment while maintaining economy.`;
          break;
        
        case BuyStrategyType.ECO:
          reasoning = `Eco round recommended. Current money ($${playerMoney}) and team average ($${Math.round(teamAverageMoney)}) are too low for effective buy.`;
          break;
        
        case BuyStrategyType.SAVE:
          reasoning = `Save recommended. With $${playerMoney} and low loss bonus ($${lossBonus}), saving for next round is optimal.`;
          break;
        
        default:
          reasoning = 'Default eco strategy recommended based on current economic situation.';
      }

      if (opponentStrategy) {
        reasoning += ` Opponents likely to ${opponentStrategy.toLowerCase().replace('_', ' ')}.`;
      }
    }

    return reasoning;
  }

  /**
   * Execute the tool
   */
  public async execute(input: EconomyBuyInput, context: ToolExecutionContext): Promise<ToolExecutionResult<EconomyBuyOutput>> {
    try {
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input parameters',
            details: validation.errors
          }
        };
      }

      const { gsiData, playerId, playerRole: providedRole } = input;

      // Get player's team
      const team = this.getPlayerTeam(gsiData, playerId);
      if (!team) {
        return {
          success: false,
          error: {
            code: 'PLAYER_NOT_FOUND',
            message: 'Player not found in GSI data'
          }
        };
      }

      // Get economic data
      const playerMoney = this.getPlayerMoney(gsiData, playerId);
      const teamAverageMoney = this.getTeamAverageMoney(gsiData, team);
      const lossBonus = this.getLossBonus(gsiData, team);
      const isFirstRound = this.isFirstRound(gsiData);

      // Determine player role
      const playerRole = providedRole || this.inferPlayerRole(gsiData, playerId);

      // Get buy strategy
      const strategy = getRecommendedBuyStrategy(
        playerMoney,
        teamAverageMoney,
        lossBonus,
        team === 'CT',
        isFirstRound
      );

      // Get advanced recommendations
      const recommendations = getAdvancedBuyRecommendations(
        playerMoney,
        strategy,
        team === 'CT',
        playerRole,
        gsiData
      );

      // Generate reasoning
      const reasoning = this.generateReasoning(
        strategy,
        playerMoney,
        teamAverageMoney,
        lossBonus,
        isFirstRound,
        playerRole
      );

      // Get opponent economy status
      const opponentTeam = team === 'CT' ? 'T' : 'CT';
      const opponents = Object.values(gsiData.allplayers || {}) as GSIPlayer[];
      const filteredOpponents = opponents.filter(p => p.team === opponentTeam);
      const opponentAvgEquipValue = filteredOpponents.reduce((sum, p) => sum + (p.state?.equip_value || 0), 0) / (filteredOpponents.length || 1);
      const opponentAvgMoney = filteredOpponents.reduce((sum, p) => sum + (p.state?.money || 0), 0) / (filteredOpponents.length || 1);

      const opponentEconomyStatus = `Opponent average equipment: $${Math.round(opponentAvgEquipValue)}, Money: $${Math.round(opponentAvgMoney)}`;

      return {
        success: true,
        data: {
          strategy,
          recommendations,
          reasoning,
          opponentEconomyStatus
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }
} 