/**
 * Core Positioning Rules and Heuristics
 * 
 * This module defines the fundamental rules and heuristics for optimal player
 * positioning in CS2. These rules are used by the positioning analysis tools
 * to evaluate and suggest improvements to player positions.
 */

import { GameContext, InterventionPriority } from '../orchestrator/OrchestratorArchitecture.js';

/**
 * Player role in the current round
 */
export enum PlayerRole {
  ENTRY = 'entry',
  SUPPORT = 'support',
  LURKER = 'lurker',
  AWPER = 'awper',
  ANCHOR = 'anchor'
}

/**
 * Position type classification
 */
export enum PositionType {
  POWER = 'power',      // Strong defensive position
  CROSSFIRE = 'crossfire', // Position for teammate support
  INFO = 'info',        // Information gathering position
  FLANK = 'flank',      // Position for flanking maneuvers
  RETAKE = 'retake',    // Position for site retake
  AFTERPLANT = 'afterplant' // Post-plant position
}

/**
 * Position risk level
 */
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Position context
 */
export interface PositionContext {
  mapName: string;
  phase: GameContext;
  teamSide: 'CT' | 'T';
  bombPlanted: boolean;
  bombsite?: 'A' | 'B';
  playerRole: PlayerRole;
  aliveTeammates: number;
  aliveEnemies: number;
  roundTime: number;
}

/**
 * Position evaluation metrics
 */
export interface PositionMetrics {
  crossfireSetup: number;   // 0-1 score
  tradePotential: number;   // 0-1 score
  coverUsage: number;       // 0-1 score
  angleIsolation: number;   // 0-1 score
  mapControl: number;       // 0-1 score
  riskLevel: RiskLevel;
  positionType: PositionType;
}

/**
 * Core positioning principles
 */
export const POSITIONING_PRINCIPLES = {
  // Crossfire setup principles
  crossfire: {
    minDistance: 200,     // Minimum distance for effective crossfire
    maxDistance: 1000,    // Maximum distance for effective crossfire
    optimalAngle: 90,     // Optimal angle between positions (degrees)
    minAngle: 45,         // Minimum effective angle (degrees)
    weights: {
      distance: 0.4,      // Weight for distance factor
      angle: 0.4,         // Weight for angle factor
      lineOfSight: 0.2    // Weight for line of sight
    }
  },

  // Trade potential principles
  trade: {
    optimalDistance: 400, // Optimal distance for trade potential
    maxDistance: 800,     // Maximum effective trade distance
    reactionTime: 1000,   // Maximum reaction time (ms)
    weights: {
      distance: 0.5,      // Weight for distance factor
      lineOfSight: 0.3,   // Weight for line of sight
      timing: 0.2         // Weight for timing factor
    }
  },

  // Cover usage principles
  cover: {
    minCoverHeight: 64,   // Minimum height for effective cover
    optimalDistance: 32,  // Optimal distance from cover
    maxDistance: 128,     // Maximum distance from cover
    weights: {
      height: 0.3,        // Weight for cover height
      distance: 0.4,      // Weight for distance to cover
      durability: 0.3     // Weight for cover durability
    }
  },

  // Angle isolation principles
  angles: {
    maxExposedAngles: 2,  // Maximum number of exposed angles
    criticalAngle: 120,   // Critical angle for multiple exposures
    weights: {
      count: 0.4,         // Weight for number of angles
      width: 0.3,         // Weight for angle width
      distance: 0.3       // Weight for distance to angle
    }
  },

  // Map control principles
  control: {
    criticalAreas: {
      'de_dust2': ['long', 'short', 'mid', 'b_tunnels'],
      'de_mirage': ['palace', 'ramp', 'mid', 'apps'],
      'de_inferno': ['banana', 'mid', 'apps', 'arch'],
      'de_overpass': ['long', 'monster', 'connector', 'heaven'],
      'de_nuke': ['yard', 'lobby', 'ramp', 'secret'],
      'de_ancient': ['mid', 'donut', 'cave', 'ramp']
    },
    weights: {
      area: 0.4,          // Weight for area importance
      access: 0.3,        // Weight for access routes
      utility: 0.3        // Weight for utility usage
    }
  }
};

/**
 * Role-specific positioning rules
 */
export const ROLE_POSITIONING = {
  [PlayerRole.ENTRY]: {
    preferredDistance: 'close',
    riskTolerance: 'high',
    mobilityRequired: 'high',
    utilityPriority: ['flash', 'smoke'],
    objectives: ['gain_entry', 'create_space']
  },
  [PlayerRole.SUPPORT]: {
    preferredDistance: 'medium',
    riskTolerance: 'medium',
    mobilityRequired: 'medium',
    utilityPriority: ['flash', 'molotov'],
    objectives: ['trade_kills', 'utility_support']
  },
  [PlayerRole.LURKER]: {
    preferredDistance: 'far',
    riskTolerance: 'medium',
    mobilityRequired: 'high',
    utilityPriority: ['smoke', 'molotov'],
    objectives: ['flank_control', 'information']
  },
  [PlayerRole.AWPER]: {
    preferredDistance: 'far',
    riskTolerance: 'low',
    mobilityRequired: 'low',
    utilityPriority: ['smoke', 'flash'],
    objectives: ['hold_angles', 'area_denial']
  },
  [PlayerRole.ANCHOR]: {
    preferredDistance: 'medium',
    riskTolerance: 'low',
    mobilityRequired: 'low',
    utilityPriority: ['molotov', 'smoke'],
    objectives: ['site_control', 'delay_pushes']
  }
};

/**
 * Phase-specific positioning rules
 */
export const PHASE_POSITIONING = {
  [GameContext.ROUND_START]: {
    priority: InterventionPriority.HIGH,
    objectives: ['map_control', 'information'],
    riskTolerance: 'medium',
    focusAreas: ['entry_points', 'mid_control']
  },
  [GameContext.MID_ROUND]: {
    priority: InterventionPriority.MEDIUM,
    objectives: ['map_control', 'site_execution'],
    riskTolerance: 'medium',
    focusAreas: ['site_approaches', 'rotations']
  },
  [GameContext.ROUND_END]: {
    priority: InterventionPriority.LOW,
    objectives: ['survival', 'weapon_recovery'],
    riskTolerance: 'low',
    focusAreas: ['safe_zones', 'exits']
  },
  [GameContext.CRITICAL_SITUATION]: {
    priority: InterventionPriority.IMMEDIATE,
    objectives: ['survival', 'trade_potential'],
    riskTolerance: 'high',
    focusAreas: ['power_positions', 'crossfires']
  },
  [GameContext.ECONOMY_PHASE]: {
    priority: InterventionPriority.MEDIUM,
    objectives: ['survival', 'damage'],
    riskTolerance: 'medium',
    focusAreas: ['safe_positions', 'exits']
  },
  [GameContext.TACTICAL_TIMEOUT]: {
    priority: InterventionPriority.LOW,
    objectives: ['setup', 'coordination'],
    riskTolerance: 'low',
    focusAreas: ['default_positions']
  }
};

/**
 * Map-specific positioning rules
 */
export const MAP_POSITIONING = {
  'de_dust2': {
    powerPositions: {
      CT: ['car', 'platform', 'goose', 'site_boxes', 'window'],
      T: ['pit', 'long_corner', 'car', 'upper_tunnels']
    },
    dangerZones: ['mid_doors', 'suicide', 'long_cross'],
    defaultSetups: {
      CT: ['car', 'platform', 'back_b', 'window', 'long'],
      T: ['tunnels', 'long', 'mid', 'spawn']
    },
    retakePositions: {
      A: ['ct_spawn', 'short', 'long'],
      B: ['window', 'door', 'tunnel']
    }
  },
  'de_mirage': {
    powerPositions: {
      CT: ['ticket', 'connector', 'window', 'van', 'kitchen'],
      T: ['palace', 'ramp', 'apps', 'top_mid']
    },
    dangerZones: ['mid', 'apps_exit', 'palace_exit'],
    defaultSetups: {
      CT: ['ticket', 'jungle', 'window', 'van', 'apps'],
      T: ['palace', 'ramp', 'mid', 'apps']
    },
    retakePositions: {
      A: ['ct', 'jungle', 'stairs'],
      B: ['kitchen', 'apps', 'short']
    }
  },
  'de_inferno': {
    powerPositions: {
      CT: ['pit', 'arch', 'new_box', 'dark', 'coffins'],
      T: ['apps', 'boiler', 'car', 'second_mid']
    },
    dangerZones: ['mid', 'banana', 'apps_exit'],
    defaultSetups: {
      CT: ['pit', 'arch', 'site', 'coffins', 'construction'],
      T: ['apps', 'mid', 'banana', 'second_mid']
    },
    retakePositions: {
      A: ['arch', 'library', 'balcony'],
      B: ['ct', 'construction', 'coffins']
    }
  }
  // Add more maps as needed
};

/**
 * Calculate position quality based on metrics
 */
export function calculatePositionQuality(metrics: PositionMetrics, context: PositionContext): number {
  // Get phase-specific weights
  const weights = getPhaseWeights(context.phase);

  // Calculate weighted score
  const score = (
    metrics.crossfireSetup * weights.crossfire +
    metrics.tradePotential * weights.trade +
    metrics.coverUsage * weights.cover +
    metrics.angleIsolation * weights.angle +
    metrics.mapControl * weights.control
  ) / Object.values(weights).reduce((a, b) => a + b, 0);

  // Apply risk modifier
  const riskModifier = getRiskModifier(metrics.riskLevel, context);

  return Math.max(0, Math.min(1, score * riskModifier));
}

/**
 * Get phase-specific metric weights
 */
function getPhaseWeights(phase: GameContext): Record<string, number> {
  switch (phase) {
    case GameContext.ROUND_START:
      return {
        crossfire: 0.2,
        trade: 0.2,
        cover: 0.2,
        angle: 0.2,
        control: 0.2
      };
    case GameContext.MID_ROUND:
      return {
        crossfire: 0.3,
        trade: 0.3,
        cover: 0.2,
        angle: 0.1,
        control: 0.1
      };
    case GameContext.CRITICAL_SITUATION:
      return {
        crossfire: 0.4,
        trade: 0.3,
        cover: 0.2,
        angle: 0.1,
        control: 0.0
      };
    default:
      return {
        crossfire: 0.2,
        trade: 0.2,
        cover: 0.2,
        angle: 0.2,
        control: 0.2
      };
  }
}

/**
 * Get risk modifier based on context
 */
function getRiskModifier(risk: RiskLevel, context: PositionContext): number {
  // Base modifier from risk level
  const baseModifier = {
    [RiskLevel.LOW]: 1.0,
    [RiskLevel.MEDIUM]: 0.9,
    [RiskLevel.HIGH]: 0.7,
    [RiskLevel.CRITICAL]: 0.5
  }[risk];

  // Adjust based on player role
  const roleModifier = {
    [PlayerRole.ENTRY]: 1.2,
    [PlayerRole.SUPPORT]: 1.0,
    [PlayerRole.LURKER]: 1.1,
    [PlayerRole.AWPER]: 0.9,
    [PlayerRole.ANCHOR]: 0.8
  }[context.playerRole];

  // Adjust based on team advantage
  const teamAdvantage = context.aliveTeammates - context.aliveEnemies;
  const advantageModifier = 1 + (teamAdvantage * 0.1);

  return baseModifier * roleModifier * advantageModifier;
} 