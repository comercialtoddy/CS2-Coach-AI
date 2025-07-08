import { GSIDataModel } from '../orchestrator/GSIDataModel';
import { BuyStrategyType, EQUIPMENT_COSTS, BuyRecommendation, getBuyRecommendations } from './economyRules';

// Player roles and their preferred weapons
export enum PlayerRole {
  ENTRY = 'ENTRY',
  SUPPORT = 'SUPPORT',
  AWP = 'AWP',
  LURK = 'LURK',
  IGL = 'IGL'
}

interface PlayerPreferences {
  role: PlayerRole;
  preferredRifles: string[];
  preferredSMGs: string[];
  preferredPistols: string[];
  utilityPriority: ('flashbang' | 'smoke' | 'he' | 'molotov' | 'decoy')[];
}

const DEFAULT_PREFERENCES: Record<PlayerRole, PlayerPreferences> = {
  [PlayerRole.ENTRY]: {
    role: PlayerRole.ENTRY,
    preferredRifles: ['AK47', 'M4A4', 'GALIL_AR', 'FAMAS'],
    preferredSMGs: ['MAC10', 'MP9'],
    preferredPistols: ['TEC9', 'FIVE_SEVEN', 'P250'],
    utilityPriority: ['flashbang', 'molotov', 'smoke', 'he']
  },
  [PlayerRole.SUPPORT]: {
    role: PlayerRole.SUPPORT,
    preferredRifles: ['M4A1_S', 'AK47', 'FAMAS', 'GALIL_AR'],
    preferredSMGs: ['MP9', 'MAC10', 'MP7'],
    preferredPistols: ['P250', 'FIVE_SEVEN', 'TEC9'],
    utilityPriority: ['smoke', 'flashbang', 'molotov', 'he']
  },
  [PlayerRole.AWP]: {
    role: PlayerRole.AWP,
    preferredRifles: ['AWP', 'SSG08', 'AK47', 'M4A4'],
    preferredSMGs: ['MP9', 'MAC10'],
    preferredPistols: ['DESERT_EAGLE', 'P250'],
    utilityPriority: ['flashbang', 'smoke', 'he', 'molotov']
  },
  [PlayerRole.LURK]: {
    role: PlayerRole.LURK,
    preferredRifles: ['M4A1_S', 'AK47', 'FAMAS', 'GALIL_AR'],
    preferredSMGs: ['UMP45', 'MP7'],
    preferredPistols: ['USP_S', 'GLOCK', 'P250'],
    utilityPriority: ['smoke', 'molotov', 'flashbang', 'decoy']
  },
  [PlayerRole.IGL]: {
    role: PlayerRole.IGL,
    preferredRifles: ['M4A4', 'AK47', 'FAMAS', 'GALIL_AR'],
    preferredSMGs: ['MP9', 'MAC10'],
    preferredPistols: ['P250', 'FIVE_SEVEN', 'TEC9'],
    utilityPriority: ['smoke', 'molotov', 'flashbang', 'he']
  }
};

/**
 * Estimate opponent team's economy based on their equipment and previous rounds
 */
function estimateOpponentEconomy(gsiData: GSIDataModel, team: 'CT' | 'T'): {
  averageValue: number;
  canFullBuy: boolean;
  probableStrategy: BuyStrategyType;
} {
  const opponentTeam = team === 'CT' ? 'T' : 'CT';
  const opponents = Object.values(gsiData.allplayers || {}).filter(p => p.team === opponentTeam);

  // Calculate average equipment value
  const totalValue = opponents.reduce((sum, player) => sum + (player.state?.equip_value || 0), 0);
  const averageValue = opponents.length > 0 ? totalValue / opponents.length : 0;

  // Determine if they can full buy next round
  const totalMoney = opponents.reduce((sum, player) => sum + (player.state?.money || 0), 0);
  const averageMoney = opponents.length > 0 ? totalMoney / opponents.length : 0;
  const canFullBuy = averageMoney >= (opponentTeam === 'CT' ? 5100 : 4700); // Minimum full buy thresholds

  // Estimate their probable strategy
  let probableStrategy: BuyStrategyType;
  if (canFullBuy) {
    probableStrategy = BuyStrategyType.FULL_BUY;
  } else if (averageValue > 2500) {
    probableStrategy = BuyStrategyType.FORCE_BUY;
  } else if (averageValue > 1000) {
    probableStrategy = BuyStrategyType.SEMI_BUY;
  } else {
    probableStrategy = BuyStrategyType.ECO;
  }

  return {
    averageValue,
    canFullBuy,
    probableStrategy
  };
}

/**
 * Adjust buy recommendations based on player role and preferences
 */
function adjustForPlayerRole(
  baseRecommendation: BuyRecommendation,
  preferences: PlayerPreferences,
  money: number,
  isCT: boolean
): BuyRecommendation {
  const recommendation = { ...baseRecommendation };

  // Adjust primary weapon based on role and preferences
  if (recommendation.primary) {
    if (preferences.role === PlayerRole.AWP && money >= EQUIPMENT_COSTS.RIFLES.AWP) {
      recommendation.primary = 'AWP';
    } else if (recommendation.primary.includes('RIFLE')) {
      for (const rifle of preferences.preferredRifles) {
        const cost = EQUIPMENT_COSTS.RIFLES[rifle as keyof typeof EQUIPMENT_COSTS.RIFLES];
        if (money >= cost) {
          recommendation.primary = rifle;
          break;
        }
      }
    } else if (recommendation.primary.includes('SMG')) {
      for (const smg of preferences.preferredSMGs) {
        const cost = EQUIPMENT_COSTS.SMGs[smg as keyof typeof EQUIPMENT_COSTS.SMGs];
        if (money >= cost) {
          recommendation.primary = smg;
          break;
        }
      }
    }
  }

  // Adjust secondary weapon based on preferences
  if (recommendation.secondary) {
    for (const pistol of preferences.preferredPistols) {
      const cost = EQUIPMENT_COSTS.PISTOLS[pistol as keyof typeof EQUIPMENT_COSTS.PISTOLS];
      if (money >= cost) {
        recommendation.secondary = pistol;
        break;
      }
    }
  }

  // Adjust utility based on role priority
  let remainingMoney = money;
  remainingMoney -= recommendation.armor ? (recommendation.helmet ? EQUIPMENT_COSTS.EQUIPMENT.KEVLAR_HELMET : EQUIPMENT_COSTS.EQUIPMENT.KEVLAR) : 0;
  remainingMoney -= recommendation.defuseKit ? EQUIPMENT_COSTS.EQUIPMENT.DEFUSE_KIT : 0;
  
  if (recommendation.primary) {
    const primaryCost = Object.entries(EQUIPMENT_COSTS.RIFLES)
      .find(([name]) => name === recommendation.primary)?.[1] ||
      Object.entries(EQUIPMENT_COSTS.SMGs)
        .find(([name]) => name === recommendation.primary)?.[1] || 0;
    remainingMoney -= primaryCost;
  }

  if (recommendation.secondary) {
    remainingMoney -= EQUIPMENT_COSTS.PISTOLS[recommendation.secondary as keyof typeof EQUIPMENT_COSTS.PISTOLS] || 0;
  }

  // Reset grenades
  recommendation.grenades = {
    flashbang: 0,
    smoke: 0,
    he: 0,
    molotov: 0,
    decoy: 0
  };

  // Buy utility based on role priority
  for (const utility of preferences.utilityPriority) {
    const cost = isCT && utility === 'molotov' 
      ? EQUIPMENT_COSTS.GRENADES.INCENDIARY 
      : EQUIPMENT_COSTS.GRENADES[utility.toUpperCase() as keyof typeof EQUIPMENT_COSTS.GRENADES];

    if (utility === 'flashbang' && remainingMoney >= cost * 2) {
      recommendation.grenades[utility] = 2;
      remainingMoney -= cost * 2;
    } else if (remainingMoney >= cost) {
      recommendation.grenades[utility] = 1;
      remainingMoney -= cost;
    }
  }

  return recommendation;
}

/**
 * Get advanced buy recommendations considering player role, preferences, and opponent economy
 */
export function getAdvancedBuyRecommendations(
  money: number,
  strategy: BuyStrategyType,
  isCT: boolean,
  playerRole: PlayerRole,
  gsiData: GSIDataModel
): BuyRecommendation {
  // Get base recommendation
  const baseRecommendation = getBuyRecommendations(money, strategy, isCT);

  // Get player preferences
  const preferences = DEFAULT_PREFERENCES[playerRole];

  // Estimate opponent economy
  const opponentEconomy = estimateOpponentEconomy(gsiData, isCT ? 'CT' : 'T');

  // Adjust strategy based on opponent economy
  let adjustedStrategy = strategy;
  if (strategy === BuyStrategyType.FORCE_BUY && opponentEconomy.probableStrategy === BuyStrategyType.ECO) {
    // Don't force if opponents are likely to eco
    adjustedStrategy = BuyStrategyType.SEMI_BUY;
  } else if (strategy === BuyStrategyType.ECO && opponentEconomy.probableStrategy === BuyStrategyType.FULL_BUY) {
    // Consider force buying if opponents are likely to full buy and we have decent money
    if (money >= (isCT ? 3000 : 2700)) {
      adjustedStrategy = BuyStrategyType.FORCE_BUY;
    }
  }

  // Get adjusted base recommendation if strategy changed
  const recommendation = adjustedStrategy !== strategy
    ? getBuyRecommendations(money, adjustedStrategy, isCT)
    : baseRecommendation;

  // Adjust for player role and preferences
  return adjustForPlayerRole(recommendation, preferences, money, isCT);
} 