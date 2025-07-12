/**
 * Data models and interfaces for Core Data Retrieval Tools
 * 
 * This file defines the input/output schemas and data structures for:
 * - Tool_GetGSIInfo: Retrieve specific GSI data points
 * - Tool_GetTrackerGGStats: Query Tracker.GG API for player statistics
 * - Tool_UpdatePlayerProfile: Update player profiles in local database
 */

import { Player } from '../../../UI/api/types.js';

// ===== GSI Data Models =====

/**
 * Available GSI data points that can be retrieved
 */
export type GSIDataPoint = 
  | 'player_state'      // Current player state (health, armor, money, etc.)
  | 'player_match_stats' // Player match statistics (kills, deaths, assists, etc.)
  | 'player_weapons'    // Player weapons and equipment
  | 'team_state'        // Team state (score, side, etc.)
  | 'map_info'          // Map information (name, phase, round, etc.)
  | 'round_info'        // Round information (phase, bomb status, etc.)
  | 'all_players'       // All players information
  | 'spectator_info'    // Spectator/observer information
  | 'game_phase'        // Current game phase
  | 'bomb_info'         // Bomb status and information
  | 'grenade_info';     // Grenade information

/**
 * GSI Player State Information
 */
export interface GSIPlayerState {
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  roundKills: number;
  roundKillsHeadshot: number;
  roundTotalDamage: number;
  equipValue: number;
  defusekit?: boolean;
  flashed?: number;
  burning?: number;
  smoked?: number;
}

/**
 * GSI Player Match Statistics
 */
export interface GSIPlayerMatchStats {
  kills: number;
  assists: number;
  deaths: number;
  mvps: number;
  score: number;
  headshots: number;
  totalDamage: number;
}

/**
 * GSI Player Weapons
 */
export interface GSIPlayerWeapons {
  primary?: {
    name: string;
    paintkit: string;
    type: string;
    ammoClip: number;
    ammoReserve: number;
    state: string;
  };
  secondary?: {
    name: string;
    paintkit: string;
    type: string;
    ammoClip: number;
    ammoReserve: number;
    state: string;
  };
  knife?: {
    name: string;
    paintkit: string;
    type: string;
    state: string;
  };
  grenades?: Array<{
    name: string;
    type: string;
    state: string;
  }>;
  c4?: {
    name: string;
    type: string;
    state: string;
  };
}

/**
 * GSI Team State
 */
export interface GSITeamState {
  score: number;
  timeoutsRemaining: number;
  matchesWonThisSeries: number;
  side: 'CT' | 'T';
  name?: string;
  id?: string;
  logo?: string;
  consecutiveRoundLosses: number;
}

/**
 * GSI Map Information
 */
export interface GSIMapInfo {
  name: string;
  phase: string;
  round: number;
  teamCT: GSITeamState;
  teamT: GSITeamState;
  currentSpectatorTarget?: string;
  roundWins?: Record<string, 'ct_win_defuse' | 'ct_win_time' | 'ct_win_elimination' | 't_win_bomb' | 't_win_elimination'>;
}

/**
 * GSI Round Information
 */
export interface GSIRoundInfo {
  phase: string;
  winTeam?: 'CT' | 'T';
  bombPlanted?: boolean;
  bombTimeLeft?: number;
  bombSite?: string;
  bombDefuser?: string;
  bombPlanter?: string;
}

/**
 * GSI All Players Information
 */
export interface GSIAllPlayersInfo {
  [steamId: string]: {
    name: string;
    observerSlot: number;
    team: 'CT' | 'T';
    state: GSIPlayerState;
    matchStats: GSIPlayerMatchStats;
    weapons: GSIPlayerWeapons;
    position?: string;
    forward?: string;
    activity?: string;
  };
}

/**
 * Complete GSI Data Structure
 */
export interface GSIData {
  playerState?: GSIPlayerState;
  playerMatchStats?: GSIPlayerMatchStats;
  playerWeapons?: GSIPlayerWeapons;
  teamState?: {
    CT: GSITeamState;
    T: GSITeamState;
  };
  mapInfo?: GSIMapInfo;
  roundInfo?: GSIRoundInfo;
  allPlayers?: GSIAllPlayersInfo;
  spectatorInfo?: {
    target: string;
    slot: number;
    mode: string;
  };
  gamePhase?: string;
  bombInfo?: {
    planted: boolean;
    timeLeft?: number;
    site?: string;
    defuser?: string;
    planter?: string;
  };
  grenadeInfo?: Array<{
    id: string;
    type: string;
    position: string;
    velocity: string;
    lifetime: number;
    effecttime: number;
  }>;
}

// ===== TrackerGG Data Models =====

/**
 * TrackerGG stat types available for retrieval
 */
export type TrackerGGStatType = 
  | 'kills'
  | 'deaths'
  | 'kdr'
  | 'adr'
  | 'headshots'
  | 'accuracy'
  | 'rating'
  | 'maps_played'
  | 'rounds_played'
  | 'wins'
  | 'win_rate'
  | 'time_played'
  | 'damage_per_round'
  | 'kills_per_round'
  | 'assists'
  | 'flash_assists'
  | 'clutch_kills'
  | 'entry_kills'
  | 'multi_kills'
  | 'bomb_planted'
  | 'bomb_defused'
  | 'knife_kills'
  | 'grenade_kills'
  | 'wallbang_kills'
  | 'no_scope_kills'
  | 'blind_kills'
  | 'smoke_kills'
  | 'through_smoke_kills'
  | 'crouch_kills'
  | 'jump_kills'
  | 'reload_kills'
  | 'team_kills'
  | 'enemy_kills'
  | 'damage_dealt'
  | 'damage_taken'
  | 'utility_damage'
  | 'enemies_flashed'
  | 'teammates_flashed'
  | 'defuse_attempts'
  | 'plant_attempts'
  | 'mvp_rounds'
  | 'first_kill_rounds'
  | 'first_death_rounds'
  | 'traded_kill_rounds'
  | 'kast_rounds'
  | 'survived_rounds'
  | 'clutch_rounds'
  | 'economy_rating'
  | 'impact_rating';

/**
 * TrackerGG Player Statistics Response
 */
export interface TrackerGGPlayerStats {
  playerId: string;
  playerName: string;
  steamId: string;
  isPremium: boolean;
  isVerified: boolean;
  countryCode: string | null;
  avatarUrl: string | null;
  lastUpdated: string;
  stats: Partial<Record<TrackerGGStatType, {
    value: number;
    displayValue: string;
    rank: number | null;
    percentile: number | null;
  }>>;
  segments: Array<{
    type: string;
    mode: string;
    stats: Record<string, any>;
  }>;
}

/**
 * TrackerGG Service Response
 */
export interface TrackerGGResponse {
  success: boolean;
  data?: TrackerGGPlayerStats;
  error?: string;
  cached?: boolean;
  rateLimitInfo?: {
    canMakeRequest: boolean;
    timeUntilNext: number;
  };
}

// ===== Player Profile Data Models =====

/**
 * Extended Player Profile with AI-relevant data
 */
export interface ExtendedPlayerProfile extends Player {
  // TrackerGG Statistics
  trackerGGStats?: TrackerGGPlayerStats;
  trackerGGLastUpdated?: string;
  
  // Performance Analytics
  performance?: {
    averageRating?: number;
    consistency?: number;
    clutchPerformance?: number;
    entryFragging?: number;
    supportRole?: number;
    gameImpact?: number;
    strengths?: string[];
    weaknesses?: string[];
  };
  
  // Game State Memory
  gameMemory?: {
    preferredPositions?: string[];
    buyingPatterns?: Record<string, number>;
    playStyle?: 'aggressive' | 'passive' | 'supportive' | 'igl' | 'lurker';
    communicationStyle?: 'frequent' | 'tactical' | 'minimal';
    tiltPatterns?: string[];
    motivationTriggers?: string[];
  };
  
  // AI Coach Notes
  coachNotes?: {
    lastAnalysis?: string;
    improvements?: string[];
    recommendations?: string[];
    behaviorPatterns?: string[];
    skillProgression?: Array<{
      date: string;
      skill: string;
      improvement: number;
      notes: string;
    }>;
  };
  
  // Metadata
  lastActiveMatch?: string;
  lastUpdated?: string;
  aiAnalysisVersion?: string;
}

/**
 * Player Profile Update Data
 */
export interface PlayerProfileUpdateData {
  // Basic Info Updates
  basicInfo?: Partial<Pick<Player, 'firstName' | 'lastName' | 'username' | 'avatar' | 'country' | 'team'>>;
  
  // TrackerGG Data
  trackerGGStats?: TrackerGGPlayerStats;
  
  // Performance Updates
  performance?: Partial<ExtendedPlayerProfile['performance']>;
  
  // Game Memory Updates
  gameMemory?: Partial<ExtendedPlayerProfile['gameMemory']>;
  
  // Coach Notes Updates
  coachNotes?: Partial<ExtendedPlayerProfile['coachNotes']>;
  
  // Metadata
  lastActiveMatch?: string;
  updateReason?: string;
  timestamp?: string;
}

// ===== Tool Input/Output Interfaces =====

/**
 * Tool_GetGSIInfo Input Interface
 */
export interface GetGSIInfoInput {
  dataPoints: GSIDataPoint[];
  includeMetadata?: boolean;
  steamId?: string; // For player-specific data
  timeout?: number; // Request timeout in milliseconds
}

/**
 * Tool_GetGSIInfo Output Interface
 */
export interface GetGSIInfoOutput {
  success: boolean;
  data?: GSIData;
  error?: string;
  timestamp: string;
  dataPoints: GSIDataPoint[];
  metadata?: {
    gameActive: boolean;
    lastUpdate: string;
    dataFreshness: number; // milliseconds since last update
    missingDataPoints?: GSIDataPoint[];
  };
}

/**
 * Tool_GetTrackerGGStats Input Interface
 */
export interface GetTrackerGGStatsInput {
  playerId: string; // Steam ID or player ID
  statTypes?: TrackerGGStatType[];
  gameMode?: 'cs2' | 'csgo';
  forceRefresh?: boolean; // Bypass cache
  timeout?: number;
}

/**
 * Tool_GetTrackerGGStats Output Interface
 */
export interface GetTrackerGGStatsOutput {
  success: boolean;
  data?: TrackerGGPlayerStats;
  error?: string;
  timestamp: string;
  cached?: boolean;
  rateLimitInfo?: {
    canMakeRequest: boolean;
    timeUntilNext: number;
    requestsMade: number;
  };
}

/**
 * Tool_UpdatePlayerProfile Input Interface
 */
export interface UpdatePlayerProfileInput {
  playerId: string;
  updateData: PlayerProfileUpdateData;
  mergeStrategy?: 'replace' | 'merge' | 'append'; // How to handle existing data
  validateData?: boolean; // Whether to validate input data
  createIfNotExists?: boolean; // Whether to create player if not found
}

/**
 * Tool_UpdatePlayerProfile Output Interface
 */
export interface UpdatePlayerProfileOutput {
  success: boolean;
  data?: ExtendedPlayerProfile;
  error?: string;
  timestamp: string;
  playerId: string;
  changes?: {
    fieldsUpdated: string[];
    previousValues?: Record<string, any>;
    newValues?: Record<string, any>;
  };
  metadata?: {
    created: boolean;
    validationErrors?: string[];
    databaseOperations: string[];
  };
}

// ===== Utility Types =====

/**
 * Common error types for tools
 */
export type ToolError = 
  | 'INVALID_INPUT'
  | 'MISSING_DATA'
  | 'API_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * Tool execution metadata
 */
export interface ToolExecutionMetadata {
  executionId: string;
  toolName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  success: boolean;
  error?: {
    type: ToolError;
    message: string;
    details?: any;
  };
  resourceUsage?: {
    memoryUsed: number;
    networkRequests: number;
    databaseQueries: number;
  };
}