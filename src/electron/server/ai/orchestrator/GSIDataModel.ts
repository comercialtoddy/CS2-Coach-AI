/**
 * GSI Data Model and Ingestion Strategy
 * 
 * This module handles the transformation of raw CSGO Game State Integration (GSI) data
 * into structured, AI-friendly data formats for the orchestrator to process.
 */

import { CSGO } from 'csgogsi';
import { v4 as uuidv4 } from 'uuid';
import {
  GameStateSnapshot,
  PlayerGameState,
  TeamGameState,
  MapGameState,
  EconomyState,
  SituationalFactor,
  GameContext,
  WeaponInfo,
  IInputHandler
} from './OrchestratorArchitecture.js';

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
export interface EnhancedWeaponInfo extends WeaponInfo {
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
export class GSIInputHandler implements IInputHandler {
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
    factors.push(...this.extractTacticalFactors(rawData));

    // Economic factors
    factors.push(...this.extractEconomicFactors(rawData));

    // Psychological factors
    factors.push(...this.extractPsychologicalFactors(rawData));

    // Positional factors
    factors.push(...this.extractPositionalFactors(rawData));

    // Temporal factors
    factors.push(...this.extractTemporalFactors(rawData));

    return factors.filter(factor => factor.relevance > 0.3); // Filter out low-relevance factors
  }

  // ===== Private Processing Methods =====

  /**
   * Determine the current game context based on GSI data
   */
  private determineGameContext(data: CSGO): GameContext {
    const phase = data.map?.phase || 'unknown';
    const roundTime = data.map?.round_wins?.length || 0;
    const freezetime = data.phase_countdowns?.phase_ends_in;

    // Determine context based on game state
    if (phase === 'freezetime' || (freezetime && freezetime > 0)) {
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

    // Calculate statistics
    const statistics = {
      kills: player.match_stats?.kills || 0,
      deaths: player.match_stats?.deaths || 0,
      assists: player.match_stats?.assists || 0,
      adr: player.match_stats?.adr || 0,
      rating: this.calculatePlayerRating(player)
    };

    // Analyze behavior
    const behaviorAnalysis = this.analyzeBehavior(player, data);

    return {
      steamId: player.steamid || 'unknown',
      name: player.name || 'Unknown Player',
      health: player.state?.health || 0,
      armor: player.state?.armor || 0,
      money: player.state?.money || 0,
      position: {
        x: player.position?.[0] || 0,
        y: player.position?.[1] || 0,
        z: player.position?.[2] || 0
      },
      weapons,
      statistics,
      observedBehaviors: behaviorAnalysis.recentActions,
      riskFactors: this.identifyRiskFactors(player, data),
      opportunities: this.identifyOpportunities(player, data)
    };
  }

  /**
   * Process team state information
   */
  private processTeamState(data: CSGO): TeamGameState {
    const player = data.player;
    const map = data.map;
    
    if (!player || !map) {
      throw new Error('Insufficient data for team state processing');
    }

    const side: 'T' | 'CT' = player.team || 'CT';
    const teamScore = side === 'CT' ? map.team_ct?.score || 0 : map.team_t?.score || 0;
    
    // Calculate team economy
    const economy = this.calculateTeamEconomy(data, side);
    
    // Analyze team coordination
    const coordination = this.analyzeTeamCoordination(data);

    return {
      side,
      score: teamScore,
      economy,
      formation: this.detectTeamFormation(data),
      strategy: this.detectTeamStrategy(data),
      communication: {
        activity: coordination.communication,
        coordination: coordination.timing
      }
    };
  }

  /**
   * Process map state information
   */
  private processMapState(data: CSGO): MapGameState {
    const map = data.map;
    
    if (!map) {
      throw new Error('No map data available in GSI');
    }

    const controlledAreas = this.analyzeMapControl(data);

    return {
      name: map.name?.replace('de_', '') || 'unknown',
      round: map.round || 0,
      phase: map.phase || 'unknown',
      bombSite: this.detectBombSite(data),
      bombState: this.analyzeBombState(data),
      controlledAreas
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
   * Calculate remaining time in various contexts
   */
  private calculateTimeRemaining(data: CSGO): number | undefined {
    if (data.phase_countdowns?.phase_ends_in) {
      return data.phase_countdowns.phase_ends_in;
    }
    
    if (data.bomb?.countdown) {
      return parseFloat(data.bomb.countdown);
    }

    return undefined;
  }

  /**
   * Check if current situation is critical
   */
  private isCriticalSituation(data: CSGO): boolean {
    const player = data.player;
    const bomb = data.bomb;
    const timeRemaining = this.calculateTimeRemaining(data);

    // Low health in dangerous situation
    if (player?.state?.health && player.state.health < 30) {
      return true;
    }

    // Bomb planted with little time
    if (bomb?.state === 'planted' && timeRemaining && timeRemaining < 10) {
      return true;
    }

    // Clutch situation (1vX)
    if (this.isClutchSituation(data)) {
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
    const baseWeapon: WeaponInfo = {
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
  private calculatePlayerRating(player: any): number {
    const stats = player.match_stats;
    if (!stats) return 0;

    const kd = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills;
    const adr = stats.adr || 0;
    
    // Simplified rating calculation
    return Math.min(2.0, (kd * 0.679 + 0.7 * adr / 100) * 1.2);
  }

  /**
   * Analyze player behavior patterns
   */
  private analyzeBehavior(player: any, data: CSGO): PlayerBehaviorAnalysis {
    // This would be more sophisticated in production
    return {
      aggression: this.calculateAggression(player, data),
      caution: this.calculateCaution(player, data),
      teamplay: this.calculateTeamplay(player, data),
      positioning: this.calculatePositioning(player, data),
      economy: this.calculateEconomyEfficiency(player, data),
      recentActions: this.getRecentActions(player, data),
      patterns: this.identifyPatterns(player, data),
      anomalies: this.identifyAnomalies(player, data)
    };
  }

  /**
   * Identify risk factors for the player
   */
  private identifyRiskFactors(player: any, data: CSGO): string[] {
    const risks: string[] = [];

    if (player.state?.health < 50) {
      risks.push('low_health');
    }

    if (player.state?.money < 2000) {
      risks.push('low_economy');
    }

    if (this.isInDangerousPosition(player, data)) {
      risks.push('dangerous_position');
    }

    if (this.isIsolatedFromTeam(player, data)) {
      risks.push('isolated_from_team');
    }

    return risks;
  }

  /**
   * Identify opportunities for the player
   */
  private identifyOpportunities(player: any, data: CSGO): string[] {
    const opportunities: string[] = [];

    if (this.hasEconomicAdvantage(player, data)) {
      opportunities.push('economic_advantage');
    }

    if (this.hasPositionalAdvantage(player, data)) {
      opportunities.push('positional_advantage');
    }

    if (this.canFlank(player, data)) {
      opportunities.push('flanking_opportunity');
    }

    return opportunities;
  }

  /**
   * Extract tactical situational factors
   */
  private extractTacticalFactors(data: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];

    // Bomb site analysis
    if (data.bomb?.state === 'planted') {
      factors.push({
        type: 'tactical',
        description: 'Bomb planted - time pressure increasing',
        severity: 'high',
        relevance: 0.9,
        actionRequired: true
      });
    }

    // Player advantage/disadvantage
    const playerCount = this.getAlivePlayers(data);
    if (playerCount.T !== playerCount.CT) {
      const advantage = playerCount.T > playerCount.CT ? 'T' : 'CT';
      factors.push({
        type: 'tactical',
        description: `${advantage} side has numerical advantage`,
        severity: 'medium',
        relevance: 0.7,
        actionRequired: false
      });
    }

    return factors;
  }

  /**
   * Extract economic situational factors
   */
  private extractEconomicFactors(data: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];
    const player = data.player;

    if (player?.state?.money && player.state.money < 1000) {
      factors.push({
        type: 'economic',
        description: 'Low personal economy - eco round likely',
        severity: 'medium',
        relevance: 0.6,
        actionRequired: false
      });
    }

    return factors;
  }

  /**
   * Extract psychological situational factors
   */
  private extractPsychologicalFactors(data: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];

    // Momentum analysis
    if (this.isOnWinningStreak(data)) {
      factors.push({
        type: 'psychological',
        description: 'Team momentum positive',
        severity: 'low',
        relevance: 0.4,
        actionRequired: false
      });
    }

    return factors;
  }

  /**
   * Extract positional situational factors
   */
  private extractPositionalFactors(data: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];
    const player = data.player;

    if (this.isInCrossfire(player, data)) {
      factors.push({
        type: 'positional',
        description: 'Player in potential crossfire',
        severity: 'high',
        relevance: 0.8,
        actionRequired: true
      });
    }

    return factors;
  }

  /**
   * Extract temporal situational factors
   */
  private extractTemporalFactors(data: CSGO): SituationalFactor[] {
    const factors: SituationalFactor[] = [];
    const timeRemaining = this.calculateTimeRemaining(data);

    if (timeRemaining && timeRemaining < 30) {
      factors.push({
        type: 'temporal',
        description: 'Low time remaining - decisions need to be quick',
        severity: 'high',
        relevance: 0.8,
        actionRequired: true
      });
    }

    return factors;
  }

  // ===== Utility Methods =====

  /**
   * Initialize weapon database with tactical information
   */
  private initializeWeaponDatabase(): void {
    // This would be populated with comprehensive weapon data
    this.weaponDatabase.set('weapon_ak47', {
      name: 'weapon_ak47',
      type: 'rifle',
      damagePerSecond: 35,
      penetrationPower: 77.5,
      accuracy: 73,
      range: 85,
      firerate: 600,
      reloadTime: 2.5
    });

    this.weaponDatabase.set('weapon_m4a1', {
      name: 'weapon_m4a1',
      type: 'rifle',
      damagePerSecond: 33,
      penetrationPower: 70,
      accuracy: 78,
      range: 88,
      firerate: 666,
      reloadTime: 3.1
    });

    // Add more weapons as needed...
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

  // Placeholder methods for complex analysis (would be implemented based on specific requirements)
  private updateBehaviorTracking(snapshot: GameStateSnapshot): void { /* Implementation */ }
  private calculateAggression(player: any, data: CSGO): number { return 0.5; }
  private calculateCaution(player: any, data: CSGO): number { return 0.5; }
  private calculateTeamplay(player: any, data: CSGO): number { return 0.5; }
  private calculatePositioning(player: any, data: CSGO): number { return 0.5; }
  private calculateEconomyEfficiency(player: any, data: CSGO): number { return 0.5; }
  private getRecentActions(player: any, data: CSGO): string[] { return []; }
  private identifyPatterns(player: any, data: CSGO): string[] { return []; }
  private identifyAnomalies(player: any, data: CSGO): string[] { return []; }
  private isInDangerousPosition(player: any, data: CSGO): boolean { return false; }
  private isIsolatedFromTeam(player: any, data: CSGO): boolean { return false; }
  private hasEconomicAdvantage(player: any, data: CSGO): boolean { return false; }
  private hasPositionalAdvantage(player: any, data: CSGO): boolean { return false; }
  private canFlank(player: any, data: CSGO): boolean { return false; }
  private calculateTeamEconomy(data: CSGO, side: 'T' | 'CT'): TeamGameState['economy'] {
    return { totalMoney: 0, averageMoney: 0, buyCapability: 'eco' };
  }
  private analyzeTeamCoordination(data: CSGO): TeamCoordinationMetrics {
    return { spacing: 0.5, coverage: 0.5, support: 0.5, timing: 0.5, communication: 0.5, strategy: 'default' };
  }
  private detectTeamFormation(data: CSGO): string { return 'spread'; }
  private detectTeamStrategy(data: CSGO): string { return 'default'; }
  private analyzeMapControl(data: CSGO): MapGameState['controlledAreas'] {
    return { T: [], CT: [], contested: [] };
  }
  private detectBombSite(data: CSGO): 'A' | 'B' | undefined { return undefined; }
  private analyzeBombState(data: CSGO): MapGameState['bombState'] {
    return data.bomb?.state === 'planted' ? 'planted' : 'none';
  }
  private determineRoundType(data: CSGO): EconomyState['roundType'] { return 'full'; }
  private calculateTeamAdvantage(data: CSGO): EconomyState['teamAdvantage'] { return 'balanced'; }
  private predictNextRoundEconomy(data: CSGO): EconomyState['nextRoundPrediction'] {
    return { T: 'buy', CT: 'buy' };
  }
  private isClutchSituation(data: CSGO): boolean { return false; }
  private isOptimalPlay(data: CSGO): boolean { return false; }
  private isMistakeWithLearningValue(data: CSGO): boolean { return false; }
  private getAlivePlayers(data: CSGO): { T: number; CT: number } { return { T: 5, CT: 5 }; }
  private isOnWinningStreak(data: CSGO): boolean { return false; }
  private isInCrossfire(player: any, data: CSGO): boolean { return false; }
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