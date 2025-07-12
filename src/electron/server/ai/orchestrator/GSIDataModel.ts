/**
 * GSI Positioning Handler
 * 
 * This module handles the ingestion and interpretation of GSI data specifically
 * for positioning analysis. It processes raw GSI data into structured formats
 * that can be used by the positioning analysis tools.
 */

import { CSGO, Player, Weapon, Grenade, Round, Team } from 'csgogsi';
import { 
  GameStateSnapshot, 
  GameContext,
  PlayerGameState,
  TeamGameState,
  MapGameState,
  EconomyState,
  WeaponInfo,
  SituationalFactorType,
  RoundType as OrchestratorRoundType
} from './OrchestratorArchitecture.js';
import { 
  PlayerRole,
  PositionType,
  RiskLevel,
  PositionContext,
  PositionMetrics,
  MAP_POSITIONING
} from '../positioning/PositioningRules.js';

// Valid map names
type MapName = 'dust2' | 'mirage' | 'inferno' | 'nuke' | 'overpass' | 'ancient' | 'vertigo' | 'anubis';
type ValidMapName = `de_${MapName}`;

// Constants for game state analysis
export const TEAM_STRATEGIES = {
  DEFAULT: 'default',
  RUSH: 'rush',
  SPLIT: 'split',
  EXECUTE: 'execute',
  HOLD: 'hold',
  RETAKE: 'retake',
  ECO: 'eco',
  FORCE: 'force',
  SLOW: 'slow'
} as const;

export type TeamStrategy = typeof TEAM_STRATEGIES[keyof typeof TEAM_STRATEGIES];

export const TEAM_FORMATIONS = {
  DEFAULT: 'default',
  SPREAD: 'spread',
  STACK: 'stack',
  SPLIT: 'split',
  STACKED_A: 'stacked_a',
  STACKED_B: 'stacked_b',
  MID_CONTROL: 'mid_control'
} as const;

export type TeamFormation = typeof TEAM_FORMATIONS[keyof typeof TEAM_FORMATIONS];

export const ROUND_TYPES = {
  PISTOL: 'eco',
  ECO: 'eco',
  FORCE: 'force_buy',
  HALF_BUY: 'semi_eco',
  FULL_BUY: 'full_buy'
} as const;

export type RoundType = OrchestratorRoundType;

// Map database structure
export interface MapArea {
  name: string;
  coordinates: {
    x: [number, number];
    y: [number, number];
    z: [number, number];
  };
  type: 'bombsite' | 'spawn' | 'chokepoint' | 'power_position';
  team?: 'CT' | 'T';
}

export interface MapData {
  name: string;
  areas: Record<string, MapArea>;
  callouts: {
    CT: Record<string, boolean>;
    T: Record<string, boolean>;
  };
}

export const MAP_DATABASE: Record<ValidMapName, MapData> = {
  'de_dust2': {
    name: 'Dust II',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_mirage': {
    name: 'Mirage',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_inferno': {
    name: 'Inferno',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_nuke': {
    name: 'Nuke',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_overpass': {
    name: 'Overpass',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_ancient': {
    name: 'Ancient',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_vertigo': {
    name: 'Vertigo',
    areas: {},
    callouts: { CT: {}, T: {} }
  },
  'de_anubis': {
    name: 'Anubis',
    areas: {},
    callouts: { CT: {}, T: {} }
  }
} as const;

// Update SituationalFactor interface
interface SituationalFactor {
  type: SituationalFactorType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  context: string[];
}

// Extend the imported SituationalFactor
export interface ExtendedSituationalFactor extends SituationalFactor {}

// Update TeamGameState interface
export interface ExtendedTeamGameState {
  side: 'CT' | 'T';
  score: number;
  economy: {
    totalMoney: number;
    averageMoney: number;
    buyCapability: 'eco' | 'semi_eco' | 'force_buy' | 'full_buy';
  };
  formation: TeamFormation;
  strategy: TeamStrategy;
  communication: {
    activity: number;
    coordination: number;
  };
  mapControl: {
    areas: string[];
    strength: number;
  };
}

// Type for weapon categories
export type WeaponCategory = WeaponInfo['type'];

// Enhanced weapon information
export interface EnhancedWeaponInfo extends WeaponInfo {
  damagePerSecond?: number;
  penetrationPower?: number;
  recoilPattern?: number[];
  accuracy?: number;
}

// Team coordination metrics
export interface TeamCoordinationMetrics {
  spacing: number;         // 0-1 (optimal spacing)
  coverage: number;        // 0-1 (map coverage)
  support: number;         // 0-1 (mutual support)
  timing: number;          // 0-1 (synchronized actions)
  communication: number;   // 0-1 (based on actions)
  strategy: string;        // Current apparent strategy
  mapControl: number;
}

// Team advantage type
export type TeamAdvantage = 'balanced' | 'advantage' | 'disadvantage';

// ===== Raw GSI Data Processing =====

/**
 * GSI data validation result
 */
export interface GSIValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  missingFields: string[];
  confidence: number; // 0-1
}

/**
 * Context change detection result
 */
export interface ContextChangeResult {
  contexts: GameContext[];
  changes: Array<{
    type: 'phase_change' | 'round_change' | 'situation_change' | 'state_change';
    from: any;
    to: any;
    significance: 'low' | 'medium' | 'high' | 'critical';
  }>;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Enhanced weapon information
 */
export interface EnhancedWeaponInfo {
  name: string;
  type: WeaponCategory;
  ammo: number;
  inSlot: number;
  damagePerSecond?: number;
  penetrationPower?: number;
  accuracy?: number;
  range?: number;
  firerate?: number;
  reloadTime?: number;
}

/**
 * Player behavior analysis
 */
export interface PlayerBehaviorAnalysis {
  aggression: number;      // 0-1
  caution: number;         // 0-1
  teamplay: number;        // 0-1
  positioning: number;     // 0-1 (quality)
  economy: number;         // 0-1 (efficiency)
  recentActions: string[];
  patterns: string[];
  anomalies: string[];
}

/**
 * Team coordination metrics
 */
export interface TeamCoordinationMetrics {
  spacing: number;         // 0-1 (optimal spacing)
  coverage: number;        // 0-1 (map coverage)
  support: number;         // 0-1 (mutual support)
  timing: number;          // 0-1 (synchronized actions)
  communication: number;   // 0-1 (based on actions)
  strategy: string;        // Current apparent strategy
}

// ===== Main Input Handler Implementation =====

/**
 * Input Handler for GSI Data Processing
 * 
 * Transforms raw CSGO GSI data into structured game state snapshots
 * with comprehensive analysis and contextual information.
 */
export class GSIInputHandler {
  private lastSnapshot: GameStateSnapshot | null = null;
  private sequenceCounter: number = 0;
  private weaponDatabase: Map<string, EnhancedWeaponInfo> = new Map();
  private behaviorHistory: Map<string, PlayerBehaviorAnalysis[]> = new Map();

  constructor() {
    this.initializeWeaponDatabase();
  }

  /**
   * Process a GSI update and create a comprehensive game state snapshot
   */
  async processGSIUpdate(rawData: CSGO): Promise<GameStateSnapshot> {
    const timestamp = new Date();
    const sequenceId = `gsi_${++this.sequenceCounter}_${timestamp.getTime()}`;

    try {
      // Create comprehensive snapshot
      const snapshot: GameStateSnapshot = {
        raw: rawData,
        processed: {
          context: this.determineGameContext(rawData),
          phase: rawData.phase_countdowns?.phase || rawData.map?.phase || 'unknown',
          timeRemaining: this.calculateTimeRemaining(rawData),
          playerState: this.processPlayerState(rawData),
          teamState: this.processTeamState(rawData),
          mapState: this.processMapState(rawData),
          economyState: this.processEconomyState(rawData),
          situationalFactors: this.extractSituationalFactors(rawData)
        },
        timestamp,
        sequenceId
      };

      // Update behavior tracking
      this.updateBehaviorTracking(snapshot);

      // Store as last snapshot for comparison
      this.lastSnapshot = snapshot;

      return snapshot;
    } catch (error) {
      console.error('Error processing GSI update:', error);
      throw new Error(`Failed to process GSI update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate the integrity and completeness of game state data
   */
  validateGameState(snapshot: GameStateSnapshot): boolean {
    const validation = this.performComprehensiveValidation(snapshot);
    return validation.isValid && validation.confidence > 0.7;
  }

  /**
   * Detect context changes between current and previous snapshots
   */
  detectContextChange(current: GameStateSnapshot, previous?: GameStateSnapshot): GameContext[] {
    const result = this.analyzeContextChanges(current, previous || this.lastSnapshot);
    return result.contexts;
  }

  /**
   * Extract situational factors that affect AI decision making
   */
  extractSituationalFactors(rawData: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];

    // Tactical factors
    if (rawData.round?.bomb === 'planted') {
      factors.push({
        type: 'tactical',
        severity: 'high',
        description: 'Bomb planted - time pressure increasing',
        context: ['bomb_planted']
      });
    }

    // Numerical advantage
    const advantage = this.calculateTeamAdvantage(rawData);
    if (advantage !== 'balanced') {
      factors.push({
        type: 'tactical',
        severity: 'medium',
        description: `${advantage} side has numerical advantage`,
        context: ['numerical_advantage']
      });
    }

    // Economic pressure
    const economy = this.processEconomyState(rawData);
    if (economy.roundType === 'eco') {
      factors.push({
        type: 'economic',
        severity: 'medium',
        description: 'Low personal economy - eco round likely',
        context: ['eco_round']
      });
    }

    // Team momentum
    if (this.checkTeamMomentum(rawData)) {
      factors.push({
        type: 'psychological',
        severity: 'low',
        description: 'Team momentum positive',
        context: ['momentum']
      });
    }

    // Positional disadvantage
    if (this.isInCrossfire(rawData)) {
      factors.push({
        type: 'positional',
        severity: 'high',
        description: 'Player in potential crossfire',
        context: ['crossfire']
      });
    }

    // Time pressure
    const timeRemaining = this.calculateTimeRemaining(rawData);
    if (timeRemaining && timeRemaining < 20) {
      factors.push({
        type: 'temporal',
        severity: 'high',
        description: 'Low time remaining - decisions need to be quick',
        context: ['time_pressure']
      });
    }

    return factors;
  }

  // ===== Private Processing Methods =====

  /**
   * Determine the current game context based on GSI data
   */
  private determineGameContext(data: CSGO): GameContext {
    const phase = data.phase_countdowns?.phase || data.map?.phase || 'unknown';
    const round = data.map?.round;
    const phaseEndsIn = data.phase_countdowns?.phase_ends_in;
    const freezetime = typeof phaseEndsIn === 'number' ? Math.round(phaseEndsIn) : 0;

    // Determine context based on game state
    if (phase === 'freezetime' || (freezetime > 0 && phase === 'live')) {
      return GameContext.ROUND_START;
    }

    if (phase === 'over') {
      return GameContext.ROUND_END;
    }

    if (phase === 'intermission') {
      return GameContext.INTERMISSION;
    }

    if (phase === 'gameover') {
      return GameContext.MATCH_END;
    }

    // Check for critical situations
    if (this.isCriticalSituation(data)) {
      return GameContext.CRITICAL_SITUATION;
    }

    // Check for learning opportunities
    if (this.isLearningOpportunity(data)) {
      return GameContext.LEARNING_OPPORTUNITY;
    }

    // Default to mid-round
    return GameContext.MID_ROUND;
  }

  /**
   * Process player state information
   */
  private processPlayerState(data: CSGO): PlayerGameState {
    const player = data.player;
    
    if (!player) {
      throw new Error('No player data available in GSI');
    }

    // Extract weapons information
    const weapons: EnhancedWeaponInfo[] = [];
    if (player.weapons) {
      Object.values(player.weapons).forEach(weapon => {
        if (weapon && weapon.name) {
          const enhancedWeapon = this.enhanceWeaponInfo(weapon);
          weapons.push(enhancedWeapon);
        }
      });
    }

    // Process equipment by counting grenades in weapons
    const equipment = {
      flash: 0,
      smoke: 0,
      molotov: 0,
      he: 0,
      defusekit: player.state?.defusekit || false
    };

    // Count grenades from weapons
    if (player.weapons) {
      Object.values(player.weapons).forEach(weapon => {
        if (weapon && weapon.type === 'Grenade') {
          switch (weapon.name) {
            case 'weapon_flashbang':
              equipment.flash++;
              break;
            case 'weapon_smokegrenade':
              equipment.smoke++;
              break;
            case 'weapon_molotov':
            case 'weapon_incgrenade':
              equipment.molotov++;
              break;
            case 'weapon_hegrenade':
              equipment.he++;
              break;
          }
        }
      });
    }

    // Calculate statistics
    const statistics = {
      kills: player.stats?.kills || 0,
      deaths: player.stats?.deaths || 0,
      assists: player.stats?.assists || 0,
      adr: this.calculateADR(player, data),
      rating: this.calculatePlayerRating(player, data),
      flashAssists: player.state?.round_kills || 0, // Using round_kills as proxy for flash assists
      enemiesFlashed: player.state?.flashed || 0, // Using flashed state as proxy
      utilityDamage: player.state?.round_totaldmg || 0, // Using total damage as proxy
      enemiesBlocked: 0 // Not directly available in GSI
    };

    // Analyze behavior
    const behaviorAnalysis = this.analyzeBehavior(player, data);

    const pos = player.position || [0, 0, 0];

    return {
      steamId: player.steamid || 'unknown',
      name: player.name || 'Unknown Player',
      health: player.state?.health || 0,
      armor: player.state?.armor || 0,
      money: player.state?.money || 0,
      position: {
        x: pos[0] || 0,
        y: pos[1] || 0,
        z: pos[2] || 0
      },
      weapons,
      equipment,
      statistics,
      observedBehaviors: behaviorAnalysis.recentActions,
      riskFactors: this.identifyRiskFactors(player, data),
      opportunities: this.identifyOpportunities(player, data)
    };
  }

  /**
   * Calculate average damage per round (ADR)
   */
  private calculateADR(player: any, data: CSGO): number {
    const totalDamage = player.state?.round_totaldmg || 0;
    const roundsPlayed = data.map?.round || 1;
    return Math.round(totalDamage / roundsPlayed);
  }

  /**
   * Process team state information
   */
  private processTeamState(data: CSGO): TeamGameState {
    const playerSide = data.player?.team?.side;
    
    if (!playerSide) {
      return {
        side: 'CT',
        score: 0,
        economy: {
          totalMoney: 0,
          averageMoney: 0,
          buyCapability: 'eco'
        },
        formation: TEAM_FORMATIONS.DEFAULT,
        strategy: TEAM_STRATEGIES.DEFAULT,
        communication: {
          activity: 0,
          coordination: 0
        },
        mapControl: 0
      };
    }

    const teamPlayers = this.getTeamPlayers(data, playerSide);
    const totalMoney = teamPlayers.reduce((sum, p) => sum + (p.state?.money || 0), 0);
    const averageMoney = teamPlayers.length > 0 ? totalMoney / teamPlayers.length : 0;
    const coordination = this.analyzeTeamCoordination(data);

    return {
      side: playerSide,
      score: playerSide === 'CT' ? data.map?.team_ct?.score || 0 : data.map?.team_t?.score || 0,
      economy: {
        totalMoney,
        averageMoney,
        buyCapability: this.determineBuyCapability(averageMoney)
      },
      formation: this.detectTeamFormation(data),
      strategy: this.detectTeamStrategy(data),
      communication: {
        activity: coordination.communication,
        coordination: coordination.timing
      },
      mapControl: coordination.mapControl
    };
  }

  /**
   * Process map state information
   */
  private processMapState(data: CSGO): MapGameState {
    return {
      name: data.map?.name || 'unknown',
      phase: data.map?.phase || 'unknown',
      round: data.map?.round || 0,
      bombState: data.round?.bomb || 'none',  // Changed from bombSite to bombState
      controlledAreas: this.analyzeMapControl(data)
    };
  }

  /**
   * Process economy state information
   */
  private processEconomyState(data: CSGO): EconomyState {
    const roundType = this.determineRoundType(data);
    const teamAdvantage = this.calculateTeamAdvantage(data);
    const nextRoundPrediction = this.predictNextRoundEconomy(data);

    return {
      roundType,
      teamAdvantage,
      nextRoundPrediction
    };
  }

  /**
   * Calculates the time remaining in the current phase
   */
  private calculateTimeRemaining(data: CSGO): number | undefined {
    if (!data.phase_countdowns?.phase_ends_in) return undefined;
    const timeStr = data.phase_countdowns.phase_ends_in;
    return typeof timeStr === 'string' ? parseFloat(timeStr) : timeStr;
  }

  /**
   * Check if current situation is critical
   */
  private isCriticalSituation(data: CSGO): boolean {
    const player = data.player;
    const round = data.round;

    if (!player || !round || !player.state) {
      return false;
    }

    // Low health
    if (player.state.health < 25) {
      return true;
    }

    // Bomb planted and player is CT
    if (round.bomb === 'planted' && player.team && player.team.side === 'CT') {
      return true;
    }

    // Clutch situation (e.g., 1vX)
    const alivePlayers = this.getAlivePlayers(data);
    const teamSide = player.team?.side;
    if (teamSide === 'CT' && alivePlayers.CT === 1 && alivePlayers.T > 1) {
      return true;
    }
    if (teamSide === 'T' && alivePlayers.T === 1 && alivePlayers.CT > 1) {
      return true;
    }

    return false;
  }

  /**
   * Check if current situation presents learning opportunity
   */
  private isLearningOpportunity(data: CSGO): boolean {
    // Perfect opportunity for teaching (e.g., good positioning, successful strategy)
    if (this.isOptimalPlay(data)) {
      return true;
    }

    // Mistake made with clear learning value
    if (this.isMistakeWithLearningValue(data)) {
      return true;
    }

    return false;
  }

  /**
   * Enhanced weapon information with tactical data
   */
  private enhanceWeaponInfo(weapon: any): EnhancedWeaponInfo {
    const baseWeapon: EnhancedWeaponInfo = {
      name: weapon.name,
      type: this.categorizeWeapon(weapon.name),
      ammo: weapon.ammo_clip,
      inSlot: weapon.slot
    };

    const enhanced = this.weaponDatabase.get(weapon.name);
    
    return {
      ...baseWeapon,
      ...enhanced
    };
  }

  /**
   * Calculate player rating based on performance
   */
  private calculatePlayerRating(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.stats || !player.state) return 0;

    // Base rating starts at 1.0
    let rating = 1.0;

    // Impact based on K/D ratio
    const kd = player.stats.kills / Math.max(1, player.stats.deaths);
    rating += (kd - 1) * 0.3;

    // Impact based on ADR
    const adr = this.calculateADR(player, data);
    rating += (adr / 100) * 0.2;

    // Impact based on utility usage
    const utilityDamage = player.state.round_totaldmg || 0;
    rating += (utilityDamage / 50) * 0.1;

    // Impact based on flash assists
    const flashAssists = player.state.round_kills || 0;
    rating += (flashAssists * 0.1);

    // Impact based on MVPs
    const mvps = player.stats.mvps || 0;
    rating += (mvps * 0.1);

    // Cap rating between 0 and 2
    return Math.max(0, Math.min(2, rating));
  }

  /**
   * Analyzes player behavior based on game state and history
   */
  private analyzeBehavior(player: CSGO['player'], data: CSGO): PlayerBehaviorAnalysis {
    if (!player || !player.state) {
      return {
        aggression: 0.5,
        caution: 0.5,
        teamplay: 0.5,
        positioning: 0.5,
        economy: 0.5,
        recentActions: [],
        patterns: [],
        anomalies: []
      };
    }

    // Calculate behavior metrics
    const aggression = this.calculateAggression(player, data);
    const caution = this.calculateCaution(player, data);
    const teamplay = this.calculateTeamplay(player, data);
    const positioning = this.calculatePositioning(player, data);
    const economy = this.calculateEconomyEfficiency(player, data);

    // Get recent actions and patterns
    const recentActions = this.getRecentActions(player, data);
    const patterns = this.identifyPatterns(player, data);
    const anomalies = this.identifyAnomalies(player, data);

    return {
      aggression,
      caution,
      teamplay,
      positioning,
      economy,
      recentActions,
      patterns,
      anomalies
    };
  }

  /**
   * Identifies risk factors based on player state and environment
   */
  private identifyRiskFactors(player: CSGO['player'], data: CSGO): string[] {
    const risks: string[] = [];
    if (!player) return risks;

    if (player.state.health < 40) {
      risks.push('Low health');
    }
    if (player.state.armor === 0) {
      risks.push('No armor');
    }
    if (this.isInDangerousPosition(data)) {
      risks.push('Exposed position');
    }
    if (this.isIsolatedFromTeam(data)) {
      risks.push('Isolated from team');
    }
    return risks;
  }

  /**
   * Identifies opportunities for the player based on game state
   */
  private identifyOpportunities(player: CSGO['player'], data: CSGO): string[] {
    const opportunities: string[] = [];
    if (!player) return opportunities;

    if (this.hasEconomicAdvantage(player, data)) {
      opportunities.push('Economic advantage');
    }
    if (this.hasPositionalAdvantage(player, data)) {
      opportunities.push('Positional advantage');
    }
    if (this.canFlank(player, data)) {
      opportunities.push('Flanking opportunity');
    }
    return opportunities;
  }

  /**
   * Extract tactical situational factors
   */
  private extractTacticalFactors(data: CSGO): ExtendedSituationalFactor[] {
    const factors: ExtendedSituationalFactor[] = [];

    // Check for bomb plant
    if (data.round?.bomb === 'planted') {
      factors.push({
        type: 'tactical',
        severity: 'high',  // Changed from number to string literal
        description: 'Bomb planted - retake situation',
        context: ['bomb_planted', 'retake']
      });
    }

    // Check for numerical advantage
    const aliveCount = this.getAlivePlayers(data);
    if (Math.abs(aliveCount.CT - aliveCount.T) >= 2) {
      factors.push({
        type: 'tactical',
        severity: 'medium',  // Changed from number to string literal
        description: 'Significant player advantage',
        context: ['numerical_advantage']
      });
    }

    return factors;
  }

  /**
   * Extract economic situational factors
   */
  private extractEconomicFactors(data: CSGO): ExtendedSituationalFactor[] {
    const factors: ExtendedSituationalFactor[] = [];

    // Check for eco round
    const economy = this.processEconomyState(data);
    if (economy.roundType === 'eco') {
      factors.push({
        type: 'economic',
        severity: 'medium',  // Changed from number to string literal
        description: 'Economic disadvantage',
        context: ['eco_round']
      });
    }

    return factors;
  }

  /**
   * Extract psychological situational factors
   */
  private extractPsychologicalFactors(data: CSGO): ExtendedSituationalFactor[] {
    const factors: ExtendedSituationalFactor[] = [];

    // Check for momentum
    if (this.isOnWinningStreak(data)) {
      factors.push({
        type: 'psychological',
        severity: 'medium',  // Changed from number to string literal
        description: 'Team has momentum',
        context: ['momentum']
      });
    }

    return factors;
  }

  /**
   * Extract positional situational factors
   */
  private extractPositionalFactors(data: CSGO): ExtendedSituationalFactor[] {
    const factors: ExtendedSituationalFactor[] = [];

    // Check for dangerous positions
    if (this.isInDangerousPosition(data)) {
      factors.push({
        type: 'positional',
        severity: 'high',  // Changed from number to string literal
        description: 'Exposed to multiple angles',
        context: ['dangerous_position']
      });
    }

    return factors;
  }

  /**
   * Extract temporal situational factors
   */
  private extractTemporalFactors(data: CSGO): ExtendedSituationalFactor[] {
    const factors: ExtendedSituationalFactor[] = [];

    // Check for time pressure
    const timeRemaining = this.calculateTimeRemaining(data);
    if (timeRemaining && timeRemaining < 20) {
      factors.push({
        type: 'temporal',
        severity: 'high',  // Changed from number to string literal
        description: 'Low time remaining',
        context: ['time_pressure']
      });
    }

    return factors;
  }

  // ===== Utility Methods =====

  /**
   * Initialize weapon database with tactical information
   */
  private initializeWeaponDatabase(): void {
    this.weaponDatabase.set('weapon_ak47', {
      name: 'weapon_ak47',
      type: 'rifle',
      ammo: 30,
      inSlot: 1,
      damagePerSecond: 35,
      penetrationPower: 77.5,
      accuracy: 0.85,
      range: 2200,
      firerate: 600,
      reloadTime: 2.5
    } as EnhancedWeaponInfo);

    this.weaponDatabase.set('weapon_m4a1', {
      name: 'weapon_m4a1',
      type: 'rifle',
      ammo: 30,
      inSlot: 1,
      damagePerSecond: 33,
      penetrationPower: 70,
      accuracy: 0.87,
      range: 2000,
      firerate: 666,
      reloadTime: 3.1
    } as EnhancedWeaponInfo);
  }

  /**
   * Categorize weapon by type
   */
  private categorizeWeapon(weaponName: string): WeaponInfo['type'] {
    if (weaponName.includes('ak47') || weaponName.includes('m4a') || weaponName.includes('famas')) {
      return 'rifle';
    }
    if (weaponName.includes('awp') || weaponName.includes('ssg08')) {
      return 'sniper';
    }
    if (weaponName.includes('glock') || weaponName.includes('usp') || weaponName.includes('deagle')) {
      return 'pistol';
    }
    if (weaponName.includes('mp') || weaponName.includes('mac10') || weaponName.includes('ump')) {
      return 'smg';
    }
    if (weaponName.includes('nova') || weaponName.includes('xm1014')) {
      return 'shotgun';
    }
    if (weaponName.includes('grenade') || weaponName.includes('flash') || weaponName.includes('smoke')) {
      return 'grenade';
    }
    return 'pistol'; // Default
  }

  /**
   * Perform comprehensive validation of game state
   */
  private performComprehensiveValidation(snapshot: GameStateSnapshot): GSIValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const missingFields: string[] = [];

    // Check required fields
    if (!snapshot.raw.player) {
      errors.push('Missing player data');
      missingFields.push('player');
    }

    if (!snapshot.raw.map) {
      errors.push('Missing map data');
      missingFields.push('map');
    }

    // Check data consistency
    if (snapshot.processed.playerState.health < 0 || snapshot.processed.playerState.health > 100) {
      warnings.push('Player health value out of range');
    }

    const confidence = errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.8) : 0.3;

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      missingFields,
      confidence
    };
  }

  /**
   * Analyze context changes between snapshots
   */
  private analyzeContextChanges(current: GameStateSnapshot, previous: GameStateSnapshot | null): ContextChangeResult {
    if (!previous) {
      return {
        contexts: [current.processed.context],
        changes: [],
        urgency: 'low'
      };
    }

    const changes: ContextChangeResult['changes'] = [];
    const contexts: GameContext[] = [current.processed.context];

    // Check for phase changes
    if (current.processed.phase !== previous.processed.phase) {
      changes.push({
        type: 'phase_change',
        from: previous.processed.phase,
        to: current.processed.phase,
        significance: 'high'
      });
    }

    // Check for round changes
    if (current.processed.mapState.round !== previous.processed.mapState.round) {
      changes.push({
        type: 'round_change',
        from: previous.processed.mapState.round,
        to: current.processed.mapState.round,
        significance: 'critical'
      });
    }

    const urgency = changes.some(c => c.significance === 'critical') ? 'critical' :
                   changes.some(c => c.significance === 'high') ? 'high' : 'medium';

    return { contexts, changes, urgency };
  }

  // Methods for complex behavior analysis
  private updateBehaviorTracking(snapshot: GameStateSnapshot): void {
    if (!snapshot.player?.steamId) return;

    const playerId = snapshot.player.steamId;
    const currentBehavior = snapshot.player.behaviorAnalysis;
    
    if (!currentBehavior) return;

    // Get existing behavior history or create new array
    const history = this.behaviorHistory.get(playerId) || [];
    
    // Add current behavior to history
    history.push({
      ...currentBehavior,
      timestamp: Date.now()
    } as PlayerBehaviorAnalysis & { timestamp: number });
    
    // Keep only last 50 behavior snapshots to prevent memory bloat
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    // Update the behavior history map
    this.behaviorHistory.set(playerId, history);
    
    // Analyze trends and patterns
    this.analyzeBehaviorTrends(playerId, history);
  }

  private analyzeBehaviorTrends(playerId: string, history: (PlayerBehaviorAnalysis & { timestamp: number })[]): void {
    if (history.length < 3) return; // Need at least 3 data points for trend analysis

    const recent = history.slice(-10); // Analyze last 10 behaviors
    const older = history.slice(-20, -10); // Compare with previous 10

    if (older.length === 0) return;

    // Calculate trend changes
    const trends = {
      aggression: this.calculateTrend(recent.map(h => h.aggression), older.map(h => h.aggression)),
      caution: this.calculateTrend(recent.map(h => h.caution), older.map(h => h.caution)),
      teamplay: this.calculateTrend(recent.map(h => h.teamplay), older.map(h => h.teamplay)),
      positioning: this.calculateTrend(recent.map(h => h.positioning), older.map(h => h.positioning)),
      economy: this.calculateTrend(recent.map(h => h.economy), older.map(h => h.economy))
    };

    // Store trends for future analysis (could be used by AI coaching system)
    console.log(`Player ${playerId} behavior trends:`, trends);
  }

  private calculateTrend(recent: number[], older: number[]): { direction: 'improving' | 'declining' | 'stable', magnitude: number } {
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    const difference = recentAvg - olderAvg;
    const magnitude = Math.abs(difference);

    let direction: 'improving' | 'declining' | 'stable';
    if (magnitude < 0.05) {
      direction = 'stable';
    } else if (difference > 0) {
      direction = 'improving';
    } else {
      direction = 'declining';
    }

    return { direction, magnitude };
  }

  private calculateAggression(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.state) return 0.5;

    let aggressionScore = 0.5; // Base score

    // Increase based on aggressive actions
    if (this.isInDangerousPosition(data)) aggressionScore += 0.2;
    if (this.isIsolatedFromTeam(data)) aggressionScore += 0.15;
    if (player.state.health < 50) aggressionScore += 0.1; // Still fighting with low HP

    // Decrease based on defensive actions
    if (player.state.defusekit) aggressionScore -= 0.1; // CT with defuse kit tends to play safer
    if (player.weapons && Object.values(player.weapons).some(w => w?.type === 'SniperRifle')) {
      aggressionScore -= 0.15; // Sniper tends to play more passively
    }

    return Math.max(0, Math.min(1, aggressionScore));
  }
  private calculateCaution(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.state) return 0.5;

    let cautionScore = 0.5; // Base score

    // Increase based on cautious behavior
    if (!this.isInDangerousPosition(data)) cautionScore += 0.2;
    if (!this.isIsolatedFromTeam(data)) cautionScore += 0.15;
    if (player.state.health < 30) cautionScore += 0.2; // Playing safer with low HP

    // Decrease based on risky behavior
    if (this.isInCrossfire(data)) cautionScore -= 0.2;
    if (this.hasEconomicAdvantage(player, data)) cautionScore -= 0.1; // Might play more aggressively

    return Math.max(0, Math.min(1, cautionScore));
  }
  private calculateTeamplay(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.state) return 0.5;

    let teamplayScore = 0.5; // Base score

    // Increase based on team-oriented actions
    if (!this.isIsolatedFromTeam(data)) teamplayScore += 0.2;
    if (player.state.round_kills > 0) teamplayScore += 0.1; // Contributing to team
    if (player.state.round_totaldmg > 0) teamplayScore += 0.1; // Using utility effectively

    // Analyze equipment sharing and support
    const hasExtraEquipment = player.state.money > 4000;
    if (hasExtraEquipment) teamplayScore += 0.1; // Potential for drops

    return Math.max(0, Math.min(1, teamplayScore));
  }
  private calculatePositioning(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.state) return 0.5;

    let positioningScore = 0.5; // Base score

    // Analyze current position
    if (this.hasPositionalAdvantage(player, data)) positioningScore += 0.2;
    if (!this.isInDangerousPosition(data)) positioningScore += 0.15;
    if (!this.isInCrossfire(data)) positioningScore += 0.15;

    // Consider map control
    if (this.canFlank(player, data)) positioningScore += 0.1;

    return Math.max(0, Math.min(1, positioningScore));
  }
  private calculateEconomyEfficiency(player: CSGO['player'], data: CSGO): number {
    if (!player || !player.state) return 0.5;

    let economyScore = 0.5; // Base score

    // Analyze equipment value vs. money management
    const equipValue = player.state.equip_value || 0;
    const money = player.state.money || 0;
    const totalValue = equipValue + money;

    // Score based on round type and equipment
    if (this.determineRoundType(data) === 'eco' && totalValue < 2000) {
      economyScore += 0.2; // Good eco management
    } else if (this.determineRoundType(data) === 'full_buy' && equipValue > 4000) {
      economyScore += 0.2; // Good full buy
    }

    // Consider utility usage
    if (player.state.round_totaldmg > 0) economyScore += 0.1; // Effective utility use

    return Math.max(0, Math.min(1, economyScore));
  }
  private getRecentActions(player: CSGO['player'], data: CSGO): string[] {
    const actions: string[] = [];

    if (!player || !player.state) return actions;

    // Check for recent kills
    if (player.state.round_kills > 0) {
      actions.push('recent_kill');
    }

    // Check for utility usage
    if (player.state.round_totaldmg > 0) {
      actions.push('used_utility');
    }

    // Check for position changes
    if (this.isInDangerousPosition(data)) {
      actions.push('aggressive_position');
    }

    // Check for economic decisions
    if (this.hasEconomicAdvantage(player, data)) {
      actions.push('good_economy');
    }

    return actions;
  }
  private identifyPatterns(player: CSGO['player'], data: CSGO): string[] {
    const patterns: string[] = [];

    if (!player || !player.state) return patterns;

    // Analyze behavior patterns
    if (this.isOnWinningStreak(data)) {
      patterns.push('winning_streak');
    }

    // Analyze positioning patterns
    if (this.hasPositionalAdvantage(player, data)) {
      patterns.push('good_positioning');
    }

    // Analyze economic patterns
    if (this.hasEconomicAdvantage(player, data)) {
      patterns.push('economic_advantage');
    }

    return patterns;
  }
  private identifyAnomalies(player: CSGO['player'], data: CSGO): string[] {
    const anomalies: string[] = [];

    if (!player || !player.state) return anomalies;

    // Check for unusual behavior
    if (this.isIsolatedFromTeam(data)) {
      anomalies.push('isolated_from_team');
    }

    // Check for risky positions
    if (this.isInCrossfire(data)) {
      anomalies.push('exposed_to_crossfire');
    }

    // Check for preventable deaths
    if (this.wasDeathPreventable(data)) {
      anomalies.push('preventable_death');
    }

    return anomalies;
  }
  private isInDangerousPosition(data: CSGO): boolean {
    if (!data.player?.position || !data.map?.name) return false;

    const mapData = this.getMapData(data.map.name);
    if (!mapData) return false;

    // Check if player is in a known dangerous area
    for (const [areaName, area] of Object.entries(mapData.areas)) {
      const [x, y, z] = data.player.position;
      if (x >= area.coordinates.x[0] && x <= area.coordinates.x[1] &&
          y >= area.coordinates.y[0] && y <= area.coordinates.y[1] &&
          z >= area.coordinates.z[0] && z <= area.coordinates.z[1]) {
        // Check if this is a critical position for the opposite team
        const isT = data.player.team?.side === 'T';
        const criticalPositions = isT ? mapData.callouts.CT : mapData.callouts.T;
        return criticalPositions.hasOwnProperty(areaName);
      }
    }

    return false;
  }
  private isIsolatedFromTeam(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.position) return false;

    const teammates = Object.values(data.players || {}).filter(p => 
      p && p.team === player.team && p.steamid !== player.steamid
    );

    for (const teammate of teammates) {
      if (!teammate || !teammate.position) continue;
      const pos1: [number, number, number] = [
        player.position[0],
        player.position[1],
        player.position[2]
      ];
      const pos2: [number, number, number] = [
        teammate.position[0],
        teammate.position[1],
        teammate.position[2]
      ];
      const distance = this.calculateDistance(pos1, pos2);
      if (distance < 500) return false;
    }

    return true;
  }
  private hasEconomicAdvantage(player: CSGO['player'], data: CSGO): boolean {
    if (!player) return false;

    const enemies = Object.values(data.players || {}).filter(p => 
      p && p.team !== player.team
    );

    for (const enemy of enemies) {
      if (!enemy) continue;
      if (enemy.state?.money && player.state?.money) {
        if (player.state.money < enemy.state.money) return false;
      }
    }

    return true;
  }
  private hasPositionalAdvantage(player: CSGO['player'], data: CSGO): boolean {
    if (!player) return false;

    const enemies = Object.values(data.players || {}).filter(p => 
      p && p.team !== player.team
    );

    for (const enemy of enemies) {
      if (!enemy) continue;
      if (enemy.state?.health && player.state?.health) {
        if (player.state.health < enemy.state.health) return false;
      }
    }

    return true;
  }
  private canFlank(player: CSGO['player'], data: CSGO): boolean {
    if (!player || !player.position) return false;

    const enemies = Object.values(data.players || {}).filter(p => 
      p && p.team !== player.team
    );

    for (const enemy of enemies) {
      if (!enemy || !enemy.position) continue;
      const pos1: [number, number, number] = [
        player.position[0],
        player.position[1],
        player.position[2]
      ];
      const pos2: [number, number, number] = [
        enemy.position[0],
        enemy.position[1],
        enemy.position[2]
      ];
      const distance = this.calculateDistance(pos1, pos2);
      if (distance < 1000) return false;
    }

    return true;
  }
  private isInCrossfire(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.position) return false;

    const enemies = Object.values(data.players || {}).filter(p => 
      p && p.team !== player.team
    );

    let visibleEnemies = 0;
    for (const enemy of enemies) {
      if (!enemy || !enemy.position) continue;
      const pos1: [number, number, number] = [
        player.position[0],
        player.position[1],
        player.position[2]
      ];
      const pos2: [number, number, number] = [
        enemy.position[0],
        enemy.position[1],
        enemy.position[2]
      ];
      if (this.hasLineOfSight(pos1, pos2)) {
        visibleEnemies++;
        if (visibleEnemies >= 2) return true;
      }
    }

    return false;
  }
  private wasDeathPreventable(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.state?.health) return false;

    const enemies = Object.values(data.players || {}).filter(p => 
      p && p.team !== player.team
    ) as Player[];

    // Check if player had a significant health advantage
    return player.state.health > 80 && enemies.every(e => e.state?.health && e.state.health < 50);
  }

  private isOnWinningStreak(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.team) return false;

    const players = Object.values(data.players || {})
      .filter(p => p && p.team === player.team) as Player[];

    // Check if team has won multiple rounds in a row
    return players.every(p => p.stats?.score > 0);
  }

  private detectTeamFormation(data: CSGO): string {
    const player = data.player;
    if (!player || !player.team) return TEAM_FORMATIONS.DEFAULT;

    const players = Object.values(data.players || {}).filter(p => 
      p && p.team === player.team
    ) as Player[];

    const positions = players.map(p => p.position).filter(Boolean) as [number, number, number][];
    if (positions.length < 2) return TEAM_FORMATIONS.DEFAULT;

    // Calculate team spread
    const spread = this.calculateTeamSpread(positions);
    if (spread > 1500) return TEAM_FORMATIONS.SPREAD;
    if (spread < 500) return TEAM_FORMATIONS.STACK;

    return TEAM_FORMATIONS.DEFAULT;
  }

  private detectTeamStrategy(data: CSGO): string {
    const player = data.player;
    if (!player || !player.team) return TEAM_STRATEGIES.DEFAULT;

    const players = Object.values(data.players || {})
      .filter(p => p && p.team?.side === player.team.side) as Player[];

    const positions = players.map(p => p.position).filter(Boolean) as [number, number, number][];
    if (positions.length < 2) return TEAM_STRATEGIES.DEFAULT;

    // Calculate average velocity
    const avgVelocity = 0; // Velocity calculation removed as it's not supported in the base type

    if (avgVelocity > 200) return TEAM_STRATEGIES.RUSH;
    if (avgVelocity < 50) return TEAM_STRATEGIES.HOLD;

    return TEAM_STRATEGIES.DEFAULT;
  }

  private getTeamPlayers(data: CSGO, side: 'CT' | 'T'): Player[] {
    return Object.values(data.players || {})
      .filter(p => p && p.team?.side === side) as Player[];
  }

  private getTeammates(data: CSGO, excludePlayer?: string): Player[] {
    const player = data.player;
    if (!player || !player.team) return [];

    return Object.values(data.players || {})
      .filter(p => p && p.team?.side === player.team.side && (!excludePlayer || p.steamid !== excludePlayer)) as Player[];
  }

  private getEnemies(data: CSGO): Player[] {
    const player = data.player;
    if (!player || !player.team) return [];

    return Object.values(data.players || {})
      .filter(p => p && p.team?.side !== player.team.side) as Player[];
  }

  private getMapData(mapName: string): MapData | undefined {
    const validMapName = `de_${mapName}` as ValidMapName;
    return MAP_DATABASE[validMapName];
  }

  private calculateTeamAdvantage(data: CSGO): TeamAdvantage {
    const alivePlayers = this.getAlivePlayers(data);
    if (alivePlayers.T === alivePlayers.CT) return 'balanced';
    return alivePlayers.T > alivePlayers.CT ? 'advantage' : 'disadvantage';
  }

  private getAlivePlayers(data: CSGO): { T: number; CT: number } {
    const players = Object.values(data.players || {});
    
    return {
      T: players.filter(p => p && p.team?.side === 'T' && p.state?.health > 0).length,
      CT: players.filter(p => p && p.team?.side === 'CT' && p.state?.health > 0).length
    };
  }

  private analyzeTeamCoordination(data: CSGO): TeamCoordinationMetrics {
    const players = Object.values(data.players || {});
    const spacing = this.calculateTeamSpread(players.map(p => p?.position).filter(Boolean) as [number, number, number][]);
    const coverage = this.calculateMapCoverage(players);
    const support = this.calculateTeamSupport(players);
    const timing = this.calculateTeamTiming(players as Player[]);
    const communication = this.calculateTeamCommunication(players as Player[]);
    const mapControl = this.calculateTeamMapControl(data);

      return {
      spacing,
      coverage,
      support,
      timing,
      communication,
      strategy: 'default',
      mapControl
      };
    }

  private analyzeMapControl(data: CSGO): MapGameState['controlledAreas'] {
    const players = Object.values(data.players || {});
    const ctPlayers = players.filter(p => p && p.team?.side === 'CT');
    const tPlayers = players.filter(p => p && p.team?.side === 'T');

      return {
      CT: ctPlayers.map(p => p?.position).filter(Boolean).map(() => 'site_a'),
      T: tPlayers.map(p => p?.position).filter(Boolean).map(() => 'site_b'),
        contested: []
      };
    }

  private determineRoundType(data: CSGO): RoundType {
    const player = data.player;
    if (!player || !player.team) return 'eco';

    const teamEconomy = this.calculateTeamEconomy(data, player.team.side);
    return teamEconomy.buyCapability;
          }

  private predictNextRoundEconomy(data: CSGO): { T: RoundType; CT: RoundType } {
    const ctEconomy = this.calculateTeamEconomy(data, 'CT');
    const tEconomy = this.calculateTeamEconomy(data, 'T');

    return {
      CT: this.determineBuyCapability(ctEconomy.averageMoney),
      T: this.determineBuyCapability(tEconomy.averageMoney)
    };
  }

  private isOptimalPlay(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.state) return false;

    // Check if player has good positioning and economy
    return this.hasPositionalAdvantage(player, data) && this.hasEconomicAdvantage(player, data);
  }

  private isMistakeWithLearningValue(data: CSGO): boolean {
    const player = data.player;
    if (!player || !player.state) return false;

    // Check if player made a mistake but had good setup
    return this.wasDeathPreventable(data) && this.hasEconomicAdvantage(player, data);
  }

  private calculateDistance(pos1: [number, number, number], pos2: [number, number, number]): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateTeamTiming(players: Player[]): number {
    // Calculate timing based on player actions and positions
    return 0.5; // Default value
  }

  private calculateTeamCommunication(players: Player[]): number {
    // Calculate communication based on player actions and utility usage
    return 0.5; // Default value
  }

  private calculateTeamMapControl(data: CSGO): number {
    // Calculate map control based on player positions and area control
    return 0.5; // Default value
  }

  private calculateTeamSupport(players: any[]): number {
    // Calculate how well players are positioned to support each other
    if (!players || players.length < 2) return 0;

    const alivePlayers = players.filter(p => p && p.state?.health > 0 && p.position);
    if (alivePlayers.length < 2) return 0;

    let totalSupport = 0;
    let supportPairs = 0;

    // Check each pair of players for mutual support potential
    for (let i = 0; i < alivePlayers.length; i++) {
      for (let j = i + 1; j < alivePlayers.length; j++) {
        const player1 = alivePlayers[i];
        const player2 = alivePlayers[j];
        
        if (!player1.position || !player2.position) continue;

        const distance = this.calculateDistance(
          player1.position as [number, number, number],
          player2.position as [number, number, number]
        );

        // Optimal support distance is between 500-1500 units
        let supportScore = 0;
        if (distance < 500) {
          // Too close - vulnerable to grenades/flanks
          supportScore = 0.3;
        } else if (distance <= 1500) {
          // Good support distance
          supportScore = 1.0 - (Math.abs(distance - 1000) / 500);
        } else if (distance <= 2500) {
          // Acceptable support distance
          supportScore = 0.5 - ((distance - 1500) / 2000);
        } else {
          // Too far for effective support
          supportScore = 0.1;
        }

        // Bonus for line of sight
        if (this.hasLineOfSight(
          player1.position as [number, number, number],
          player2.position as [number, number, number]
        )) {
          supportScore += 0.2;
        }

        // Bonus for covering different angles
        const angleDifference = this.calculateAngleDifference(player1, player2);
        if (angleDifference > 45) {
          supportScore += 0.1;
        }

        totalSupport += Math.max(0, Math.min(1, supportScore));
        supportPairs++;
      }
    }

    return supportPairs > 0 ? totalSupport / supportPairs : 0;
  }

  private calculateAngleDifference(player1: any, player2: any): number {
    // Calculate angle difference based on player positions and facing directions
    if (!player1?.position || !player2?.position) return 0;

    // If we have facing angles, use them directly
    if (player1.forward && player2.forward) {
      const angle1 = Math.atan2(player1.forward.y, player1.forward.x) * (180 / Math.PI);
      const angle2 = Math.atan2(player2.forward.y, player2.forward.x) * (180 / Math.PI);
      return this.normalizeAngleDifference(angle1, angle2);
    }

    // Fallback: calculate based on relative positions
    const dx = player2.position[0] - player1.position[0];
    const dy = player2.position[1] - player1.position[1];
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Assume players are generally facing forward (0 degrees) and calculate difference
    return Math.abs(angle) > 90 ? 180 - Math.abs(angle) : Math.abs(angle);
  }

  private normalizeAngleDifference(angle1: number, angle2: number): number {
    // Normalize angles to 0-360 range
    const normalizeAngle = (angle: number): number => {
      angle = angle % 360;
      return angle < 0 ? angle + 360 : angle;
    };

    const norm1 = normalizeAngle(angle1);
    const norm2 = normalizeAngle(angle2);
    
    // Calculate the absolute difference
    let diff = Math.abs(norm1 - norm2);
    
    // Take the smaller angle (shortest path)
    if (diff > 180) {
      diff = 360 - diff;
    }
    
    return diff;
  }

  private calculateTeamEconomy(data: CSGO, side: 'CT' | 'T'): ExtendedTeamGameState['economy'] {
    const players = Object.values(data.players || {})
      .filter(p => p && p.team?.side === side) as Player[];

    let totalMoney = 0;
    for (const player of players) {
      totalMoney += player.state?.money || 0;
    }

    const averageMoney = players.length > 0 ? Math.round(totalMoney / players.length) : 0;
    const buyCapability = this.determineBuyCapability(averageMoney);

    return {
      totalMoney,
      averageMoney,
      buyCapability
    };
  }

  private determineBuyCapability(averageMoney: number): OrchestratorRoundType {
    if (averageMoney < 2000) return 'eco';
    if (averageMoney < 3500) return 'semi_eco';
    if (averageMoney < 5000) return 'force_buy';
    return 'full_buy';
  }

  private calculateTeamSpread(positions: [number, number, number][]): number {
    if (positions.length < 2) return 0;

    let maxDistance = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i][0] - positions[j][0];
        const dy = positions[i][1] - positions[j][1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxDistance = Math.max(maxDistance, distance);
      }
    }

    return maxDistance;
  }

  private calculateMapCoverage(players: any[], mapName?: string): number {
    if (!mapName || !players.length) return 0.5;

    const mapData = this.getMapData(mapName);
    if (!mapData || !mapData.areas) return 0.5;

    const areas = Object.values(mapData.areas);
    let coveredAreas = 0;

    for (const area of areas) {
      if (!area || !area.coordinates) continue;
      const isAreaCovered = players.some(player => {
        if (!player?.position) return false;
        const [x, y, z] = player.position;
        const coords = area.coordinates;
        return x >= coords.x[0] && x <= coords.x[1] &&
               y >= coords.y[0] && y <= coords.y[1] &&
               z >= coords.z[0] && z <= coords.z[1];
      });
      if (isAreaCovered) coveredAreas++;
    }

    return coveredAreas / areas.length;
  }

  private hasLineOfSight(from: [number, number, number], to: [number, number, number]): boolean {
    // Simplified line of sight check - in reality, this would use ray casting against map geometry
    return true;
  }

  private checkTeamMomentum(data: CSGO): boolean {
    const team = data.player?.team;
    if (!team || !data.map) return false;

    // Check if team has won multiple rounds in a row
    const consecutiveWins = team.side === 'CT' ? 
      data.map.team_ct?.consecutive_round_losses === 0 :
      data.map.team_t?.consecutive_round_losses === 0;

    return consecutiveWins;
  }
}

// ===== Factory Function =====

/**
 * Create and initialize a GSI Input Handler
 */
export function createGSIInputHandler(): GSIInputHandler {
  return new GSIInputHandler();
}

// ===== Export Default Instance =====

export const defaultGSIHandler = createGSIInputHandler();