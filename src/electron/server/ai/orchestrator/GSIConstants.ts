/**
 * CS2 Game Constants
 * 
 * This file contains constants and data about CS2 weapons, maps, and other game elements
 * used for analysis and decision making.
 */

/**
 * Weapon information database
 */
export const WEAPON_DATABASE = new Map([
  ['weapon_ak47', {
    name: 'AK-47',
    type: 'rifle',
    damagePerSecond: 360,
    penetrationPower: 0.98,
    accuracy: 0.85,
    range: 0.9,
    firerate: 600,
    reloadTime: 2.5
  }],
  ['weapon_m4a1', {
    name: 'M4A1',
    type: 'rifle',
    damagePerSecond: 340,
    penetrationPower: 0.92,
    accuracy: 0.9,
    range: 0.85,
    firerate: 666,
    reloadTime: 3.1
  }],
  ['weapon_m4a1_silencer', {
    name: 'M4A1-S',
    type: 'rifle',
    damagePerSecond: 320,
    penetrationPower: 0.92,
    accuracy: 0.95,
    range: 0.88,
    firerate: 600,
    reloadTime: 3.1
  }],
  ['weapon_awp', {
    name: 'AWP',
    type: 'sniper',
    damagePerSecond: 450,
    penetrationPower: 0.97,
    accuracy: 0.99,
    range: 1.0,
    firerate: 41,
    reloadTime: 3.7
  }],
  ['weapon_deagle', {
    name: 'Desert Eagle',
    type: 'pistol',
    damagePerSecond: 280,
    penetrationPower: 0.85,
    accuracy: 0.75,
    range: 0.7,
    firerate: 267,
    reloadTime: 2.2
  }],
  ['weapon_usp_silencer', {
    name: 'USP-S',
    type: 'pistol',
    damagePerSecond: 180,
    penetrationPower: 0.65,
    accuracy: 0.85,
    range: 0.6,
    firerate: 352,
    reloadTime: 2.2
  }],
  ['weapon_glock', {
    name: 'Glock-18',
    type: 'pistol',
    damagePerSecond: 160,
    penetrationPower: 0.6,
    accuracy: 0.8,
    range: 0.55,
    firerate: 400,
    reloadTime: 2.2
  }],
  ['weapon_flashbang', {
    name: 'Flashbang',
    type: 'grenade',
    damagePerSecond: 0,
    penetrationPower: 0,
    accuracy: 0.9,
    range: 0.8,
    firerate: 0,
    reloadTime: 0
  }],
  ['weapon_smokegrenade', {
    name: 'Smoke Grenade',
    type: 'grenade',
    damagePerSecond: 0,
    penetrationPower: 0,
    accuracy: 0.9,
    range: 0.85,
    firerate: 0,
    reloadTime: 0
  }],
  ['weapon_hegrenade', {
    name: 'HE Grenade',
    type: 'grenade',
    damagePerSecond: 98,
    penetrationPower: 0.7,
    accuracy: 0.9,
    range: 0.75,
    firerate: 0,
    reloadTime: 0
  }],
  ['weapon_molotov', {
    name: 'Molotov',
    type: 'grenade',
    damagePerSecond: 40,
    penetrationPower: 0,
    accuracy: 0.9,
    range: 0.7,
    firerate: 0,
    reloadTime: 0
  }],
  ['weapon_incgrenade', {
    name: 'Incendiary Grenade',
    type: 'grenade',
    damagePerSecond: 40,
    penetrationPower: 0,
    accuracy: 0.9,
    range: 0.7,
    firerate: 0,
    reloadTime: 0
  }]
]);

/**
 * Map information database
 */
export const MAP_DATABASE = new Map([
  ['de_dust2', {
    name: 'Dust II',
    areas: {
      'T Spawn': { x: [-2106, -1613], y: [1192, 1719], z: [32, 68] },
      'Long A': { x: [-1192, -415], y: [1698, 2339], z: [0, 142] },
      'A Site': { x: [211, 847], y: [1781, 2621], z: [0, 142] },
      'Short A': { x: [364, 907], y: [1781, 2339], z: [134, 270] },
      'Mid': { x: [-1192, -415], y: [1192, 1698], z: [0, 142] },
      'B Tunnels': { x: [-2106, -1613], y: [665, 1192], z: [32, 168] },
      'B Site': { x: [-2106, -1613], y: [138, 665], z: [32, 168] }
    },
    defaultStrategies: {
      CT: ['2-1-2', '3-1-1', '2-2-1'],
      T: ['Long Take', 'B Rush', 'Mid to B', 'Split A']
    },
    criticalPositions: {
      CT: ['Car', 'Platform', 'Goose', 'Window', 'Door'],
      T: ['Pit', 'Long Corner', 'Short', 'Upper Tunnels']
    }
  }],
  ['de_mirage', {
    name: 'Mirage',
    areas: {
      'T Spawn': { x: [-3217, -2666], y: [-1524, -973], z: [-167, -39] },
      'A Ramp': { x: [-1007, -456], y: [-293, 258], z: [-167, -39] },
      'Palace': { x: [-1007, -456], y: [-293, 258], z: [-167, -39] },
      'A Site': { x: [-1007, -456], y: [-293, 258], z: [-167, -39] },
      'Mid': { x: [-1558, -1007], y: [-804, -293], z: [-167, -39] },
      'B Apps': { x: [-2666, -2115], y: [-804, -293], z: [-167, -39] },
      'B Site': { x: [-2666, -2115], y: [-293, 258], z: [-167, -39] }
    },
    defaultStrategies: {
      CT: ['2-1-2', '3-1-1', '2-2-1'],
      T: ['A Execute', 'B Rush', 'Mid Control', 'Split B']
    },
    criticalPositions: {
      CT: ['Stairs', 'Jungle', 'Window', 'Short', 'Van'],
      T: ['Palace', 'Ramp', 'Underpass', 'Apps']
    }
  }]
]);

/**
 * Common team formations
 */
export const TEAM_FORMATIONS = {
  DEFAULT: 'default',      // Standard 2-1-2 setup
  STACKED_A: 'stacked_a', // Heavy A presence (3+ players)
  STACKED_B: 'stacked_b', // Heavy B presence (3+ players)
  SPREAD: 'spread',       // Players spread across map
  MID_CONTROL: 'mid',     // Focus on mid control
  RETAKE: 'retake'       // Setup for retake
};

/**
 * Common team strategies
 */
export const TEAM_STRATEGIES = {
  DEFAULT: 'default',     // Standard play
  RUSH: 'rush',          // Fast execute
  SLOW: 'slow',          // Slow, methodical play
  SPLIT: 'split',        // Split site attack
  FAKE: 'fake',          // Fake execute
  ECO: 'eco',           // Economy round
  FORCE: 'force'        // Force buy round
};

/**
 * Round types based on economy
 */
export const ROUND_TYPES = {
  PISTOL: 'pistol',      // Pistol round
  ECO: 'eco',           // Economy round
  FORCE: 'force',       // Force buy
  HALF_BUY: 'half',     // Partial equipment
  FULL_BUY: 'full'      // Full equipment
};

/**
 * Risk levels for different situations
 */
export const RISK_LEVELS = {
  LOW: 'low',           // Safe situation
  MEDIUM: 'medium',     // Some risk
  HIGH: 'high',         // Dangerous situation
  CRITICAL: 'critical'  // Extremely dangerous
};

/**
 * Common player behaviors
 */
export const PLAYER_BEHAVIORS = {
  AGGRESSIVE: 'aggressive',    // Pushing/taking fights
  PASSIVE: 'passive',         // Holding/defensive
  SUPPORTIVE: 'supportive',   // Using utility/supporting
  FLANKING: 'flanking',      // Moving for flank
  LURKING: 'lurking'         // Sneaking/lurking
};

/**
 * Opportunity types for players
 */
export const OPPORTUNITY_TYPES = {
  FLANK: 'flank',            // Flank opportunity
  TRADE: 'trade',            // Trade kill opportunity
  UTILITY: 'utility',        // Utility usage
  INFORMATION: 'info',       // Information gathering
  ECONOMY: 'economy'         // Economic advantage
}; 