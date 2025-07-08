/**
 * CS2 Economy Rules and Constants
 */

// Round Money Rewards
export const ROUND_REWARDS = {
  WIN: {
    NORMAL: 3500,
    BOMB_PLANTED: 3500,
    ELIMINATION: 3500,
    TIME_EXPIRED: 3500
  },
  LOSS: {
    FIRST_ROUND: 1900,
    CONSECUTIVE_FIRST: 2400,
    CONSECUTIVE_SECOND: 2900,
    CONSECUTIVE_THIRD: 3400,
    CONSECUTIVE_MAX: 3400
  }
};

// Kill Rewards
export const KILL_REWARDS = {
  KNIFE: 1500,
  ZEUS: 300,
  DEFAULT: 300,
  BONUS_HOSTAGE_TAKEN: 300,
  BONUS_BOMB_PLANTED: 300,
  BONUS_BOMB_DEFUSED: 300
};

// Equipment Costs
export const EQUIPMENT_COSTS = {
  PISTOLS: {
    GLOCK: 0,
    USP_S: 0,
    P2000: 0,
    P250: 300,
    FIVE_SEVEN: 500,
    TEC9: 500,
    CZ75_AUTO: 500,
    DUAL_BERETTAS: 400,
    DESERT_EAGLE: 700,
    R8_REVOLVER: 600
  },
  RIFLES: {
    AK47: 2700,
    M4A4: 3100,
    M4A1_S: 3100,
    FAMAS: 2050,
    GALIL_AR: 1800,
    AUG: 3300,
    SG553: 3000,
    AWP: 4750,
    SSG08: 1700,
    SCAR20: 5000,
    G3SG1: 5000
  },
  SMGs: {
    MP9: 1250,
    MAC10: 1050,
    MP7: 1500,
    UMP45: 1200,
    P90: 2350,
    PP_BIZON: 1400
  },
  HEAVY: {
    NOVA: 1050,
    XM1014: 2000,
    MAG7: 1300,
    SAWED_OFF: 1100,
    M249: 5200,
    NEGEV: 1700
  },
  EQUIPMENT: {
    KEVLAR: 650,
    KEVLAR_HELMET: 1000,
    ZEUS: 200,
    DEFUSE_KIT: 400
  },
  GRENADES: {
    FLASHBANG: 200,
    SMOKE: 300,
    HE: 300,
    MOLOTOV: 400,
    INCENDIARY: 600,
    DECOY: 50
  }
};

// Economy Thresholds
export const ECONOMY_THRESHOLDS = {
  FULL_BUY: {
    T: {
      MIN: 4700, // AK47 + Kevlar + Helmet + Basic Nades
      IDEAL: 6000 // Full loadout with all nades
    },
    CT: {
      MIN: 5100, // M4 + Kevlar + Helmet + Basic Nades
      IDEAL: 6400 // Full loadout with all nades
    }
  },
  FORCE_BUY: {
    T: {
      MIN: 2500, // Galil + Kevlar
      MAX: 4500
    },
    CT: {
      MIN: 2700, // FAMAS + Kevlar
      MAX: 4900
    }
  },
  ECO: {
    MAX: 2000 // Maximum spend on eco rounds
  }
};

// Buy Strategy Types
export enum BuyStrategyType {
  FULL_BUY = 'FULL_BUY',
  FORCE_BUY = 'FORCE_BUY',
  SEMI_BUY = 'SEMI_BUY',
  ECO = 'ECO',
  SAVE = 'SAVE'
}

// Buy Strategy Recommendations
export interface BuyRecommendation {
  strategy: BuyStrategyType;
  primary?: string;
  secondary?: string;
  armor: boolean;
  helmet: boolean;
  defuseKit?: boolean; // CT only
  grenades: {
    flashbang: number;
    smoke: number;
    he: number;
    molotov: number;
    decoy: number;
  };
}

/**
 * Determine if a full buy is possible based on available money and team side
 */
export function canFullBuy(money: number, isCT: boolean): boolean {
  const threshold = isCT ? ECONOMY_THRESHOLDS.FULL_BUY.CT.MIN : ECONOMY_THRESHOLDS.FULL_BUY.T.MIN;
  return money >= threshold;
}

/**
 * Determine if a force buy is viable based on available money and team side
 */
export function shouldForceBuy(money: number, isCT: boolean, lossBonus: number): boolean {
  const threshold = isCT ? ECONOMY_THRESHOLDS.FORCE_BUY.CT : ECONOMY_THRESHOLDS.FORCE_BUY.T;
  return money >= threshold.MIN && money <= threshold.MAX && lossBonus >= ROUND_REWARDS.LOSS.CONSECUTIVE_SECOND;
}

/**
 * Get recommended buy strategy based on available money, team economy, and game state
 */
export function getRecommendedBuyStrategy(
  playerMoney: number,
  teamAverageMoney: number,
  lossBonus: number,
  isCT: boolean,
  isFirstRound: boolean,
  previousStrategy?: BuyStrategyType
): BuyStrategyType {
  // First round is always pistol round
  if (isFirstRound) {
    return BuyStrategyType.SEMI_BUY;
  }

  // Check if full buy is possible
  if (canFullBuy(playerMoney, isCT)) {
    return BuyStrategyType.FULL_BUY;
  }

  // Check if we should force buy
  if (shouldForceBuy(playerMoney, isCT, lossBonus)) {
    return BuyStrategyType.FORCE_BUY;
  }

  // If team average money is low and we're on a low loss bonus, save
  if (teamAverageMoney < ECONOMY_THRESHOLDS.ECO.MAX && lossBonus <= ROUND_REWARDS.LOSS.CONSECUTIVE_FIRST) {
    return BuyStrategyType.SAVE;
  }

  // Default to eco
  return BuyStrategyType.ECO;
}

/**
 * Get detailed buy recommendations based on strategy and available money
 */
export function getBuyRecommendations(
  money: number,
  strategy: BuyStrategyType,
  isCT: boolean
): BuyRecommendation {
  const recommendation: BuyRecommendation = {
    strategy,
    armor: false,
    helmet: false,
    grenades: {
      flashbang: 0,
      smoke: 0,
      he: 0,
      molotov: 0,
      decoy: 0
    }
  };

  switch (strategy) {
    case BuyStrategyType.FULL_BUY:
      recommendation.armor = true;
      recommendation.helmet = true;
      if (isCT) {
        recommendation.primary = money >= EQUIPMENT_COSTS.RIFLES.M4A4 ? 'M4A4' : 'FAMAS';
        recommendation.defuseKit = true;
      } else {
        recommendation.primary = 'AK47';
      }
      // Add grenades based on remaining money
      let remainingMoney = money - (EQUIPMENT_COSTS.EQUIPMENT.KEVLAR_HELMET +
        (isCT ? EQUIPMENT_COSTS.RIFLES.M4A4 : EQUIPMENT_COSTS.RIFLES.AK47) +
        (isCT ? EQUIPMENT_COSTS.EQUIPMENT.DEFUSE_KIT : 0));
      
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.SMOKE) {
        recommendation.grenades.smoke = 1;
        remainingMoney -= EQUIPMENT_COSTS.GRENADES.SMOKE;
      }
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.FLASHBANG * 2) {
        recommendation.grenades.flashbang = 2;
        remainingMoney -= EQUIPMENT_COSTS.GRENADES.FLASHBANG * 2;
      }
      if (remainingMoney >= (isCT ? EQUIPMENT_COSTS.GRENADES.INCENDIARY : EQUIPMENT_COSTS.GRENADES.MOLOTOV)) {
        recommendation.grenades.molotov = 1;
        remainingMoney -= (isCT ? EQUIPMENT_COSTS.GRENADES.INCENDIARY : EQUIPMENT_COSTS.GRENADES.MOLOTOV);
      }
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.HE) {
        recommendation.grenades.he = 1;
      }
      break;

    case BuyStrategyType.FORCE_BUY:
      recommendation.armor = true;
      recommendation.helmet = money >= EQUIPMENT_COSTS.EQUIPMENT.KEVLAR_HELMET;
      if (isCT) {
        recommendation.primary = 'FAMAS';
      } else {
        recommendation.primary = 'GALIL_AR';
      }
      // Add one flash and smoke if possible
      remainingMoney = money - (EQUIPMENT_COSTS.EQUIPMENT.KEVLAR +
        (isCT ? EQUIPMENT_COSTS.RIFLES.FAMAS : EQUIPMENT_COSTS.RIFLES.GALIL_AR));
      
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.FLASHBANG) {
        recommendation.grenades.flashbang = 1;
        remainingMoney -= EQUIPMENT_COSTS.GRENADES.FLASHBANG;
      }
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.SMOKE) {
        recommendation.grenades.smoke = 1;
      }
      break;

    case BuyStrategyType.SEMI_BUY:
      recommendation.armor = true;
      if (isCT) {
        recommendation.primary = money >= EQUIPMENT_COSTS.SMGs.MP9 ? 'MP9' : undefined;
      } else {
        recommendation.primary = money >= EQUIPMENT_COSTS.SMGs.MAC10 ? 'MAC10' : undefined;
      }
      recommendation.secondary = money < (isCT ? EQUIPMENT_COSTS.SMGs.MP9 : EQUIPMENT_COSTS.SMGs.MAC10) ? 'P250' : undefined;
      // Add flash if possible
      remainingMoney = money - (EQUIPMENT_COSTS.EQUIPMENT.KEVLAR +
        (recommendation.primary ? (isCT ? EQUIPMENT_COSTS.SMGs.MP9 : EQUIPMENT_COSTS.SMGs.MAC10) : EQUIPMENT_COSTS.PISTOLS.P250));
      
      if (remainingMoney >= EQUIPMENT_COSTS.GRENADES.FLASHBANG) {
        recommendation.grenades.flashbang = 1;
      }
      break;

    case BuyStrategyType.ECO:
      recommendation.secondary = money >= EQUIPMENT_COSTS.PISTOLS.P250 ? 'P250' : undefined;
      // Maybe buy armor if we have enough money
      if (money >= EQUIPMENT_COSTS.EQUIPMENT.KEVLAR + EQUIPMENT_COSTS.PISTOLS.P250) {
        recommendation.armor = true;
      }
      break;

    case BuyStrategyType.SAVE:
      // Don't buy anything
      break;
  }

  return recommendation;
} 