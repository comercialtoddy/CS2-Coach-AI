/**
 * GSI Positioning Handler
 * 
 * This module handles the ingestion and interpretation of GSI data specifically
 * for positioning analysis. It processes raw GSI data into structured formats
 * that can be used by the positioning analysis tools.
 */

import { CSGO, Player, Weapon, Grenade, Round } from 'csgogsi';
import { GameStateSnapshot, GameContext } from '../orchestrator/OrchestratorArchitecture.js';
import { 
  PlayerRole,
  PositionType,
  RiskLevel,
  PositionContext,
  PositionMetrics,
  MAP_POSITIONING
} from './PositioningRules.js';

// Primeiro, vamos definir os nomes dos mapas sem o prefixo 'de_'
type MapName = 'dust2' | 'mirage' | 'inferno' | 'nuke' | 'overpass' | 'ancient' | 'vertigo' | 'anubis';

// Depois, criamos o tipo ValidMapName que inclui o prefixo
type ValidMapName = `de_${MapName}`;

// Função para validar o nome do mapa
function isValidMapName(mapName: string): mapName is ValidMapName {
  const validMaps = [
    'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke',
    'de_overpass', 'de_ancient', 'de_vertigo', 'de_anubis'
  ] as const;
  return validMaps.includes(mapName as ValidMapName);
}

// Interface para o posicionamento do mapa
interface MapPositioning {
  powerPositions: {
    CT: string[];
    T: string[];
  };
  dangerZones: string[];
  defaultSetups: {
    CT: string[];
    T: string[];
  };
  retakePositions: {
    A: string[];
    B: string[];
  };
}

// Interface para os dados de posicionamento do mapa
type MapPositioningData = Record<ValidMapName, MapPositioning>;

interface ExtendedGrenade extends Omit<Grenade, 'position' | 'type' | 'owner'> {
  position?: [number, number, number];
  type: 'decoy' | 'smoke' | 'frag' | 'firebomb' | 'flashbang' | 'inferno';
  owner: string;
}

interface ExtendedRound extends Omit<Round, 'bomb_site'> {
  bomb_site?: 'A' | 'B';
}

// Update the MAP_POSITIONING type
const MAP_POSITIONING_DATA: MapPositioningData = {
  'de_dust2': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_mirage': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_inferno': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_nuke': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_overpass': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_ancient': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_vertigo': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  },
  'de_anubis': {
    powerPositions: {
      CT: [],
      T: []
    },
    dangerZones: [],
    defaultSetups: {
      CT: [],
      T: []
    },
    retakePositions: {
      A: [],
      B: []
    }
  }
} as const;

// Add these type definitions:
type WeaponType = 'Rifle' | 'SniperRifle' | 'Pistol' | 'Knife' | 'Grenade' | 'C4' | 'Shotgun' | 'Machine Gun';

interface ExtendedWeapon {
  name?: string;
  type?: WeaponType;
  state?: string;
  ammo_clip?: number;
  ammo_reserve?: number;
}

interface PlayerState {
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  round_kills?: number;
  round_killhs?: number;
  round_totaldmg?: number;
  defusekit?: boolean;
  flashed?: number;
  burning?: number;
  smoked?: number;
}

interface ExtendedPlayer extends Omit<Player, 'weapons'> {
  weapons: Weapon[];
  velocity?: [number, number, number];
  observer_slot?: number;
  stats: {
    kills: number;
    assists: number;
    deaths: number;
    mvps: number;
    score: number;
  };
}

interface ExtendedMap {
  name: string;
  phase: string;
  round: number;
  team_ct?: {
    score: number;
  };
  team_t?: {
    score: number;
  };
}

interface ExtendedCSGO {
  player?: ExtendedPlayer;
  players: ExtendedPlayer[];
  map?: ExtendedMap;
  phase_countdowns?: {
    phase: string;
  };
  round?: {
    phase: string;
    bomb?: string;
    bomb_site?: 'A' | 'B';
  };
  grenades?: Record<string, {
    type: string;
    position?: [number, number, number];
    owner?: string;
  }>;
}

/**
 * Position data from GSI
 */
interface PositionData {
  x: number;
  y: number;
  z: number;
  angle: number;
  velocity: number;
}

/**
 * Teammate position data
 */
interface TeammatePosition {
  steamId: string;
  position: PositionData;
  role: PlayerRole;
  weapons: string[];
  utility: string[];
}

/**
 * Enemy position data (when available)
 */
interface EnemyPosition {
  steamId: string;
  position: PositionData;
  lastKnownTime: number;
  confidence: number; // 0-1 based on info freshness
}

/**
 * Area control data
 */
interface AreaControl {
  areaName: string;
  controllingTeam: 'CT' | 'T' | 'contested' | 'none';
  controlStrength: number; // 0-1
  contestedBy: string[]; // Player steamIds
}

/**
 * Utility data
 */
interface UtilityData {
  type: 'smoke' | 'molotov' | 'flash' | 'he';
  position: PositionData;
  lifetime: number;
  effectRadius: number;
  thrownBy: string;
}

/**
 * Main GSI positioning handler class
 */
export class GSIPositioningHandler {
  private lastUpdate: GameStateSnapshot | null = null;
  private positionHistory: Map<string, PositionData[]> = new Map();
  private areaControl: Map<string, AreaControl> = new Map();
  private activeUtility: UtilityData[] = [];
  private roleAssignments: Map<string, PlayerRole> = new Map();

  constructor() {
    // Initialize area control tracking for all maps
    Object.keys(MAP_POSITIONING_DATA).forEach(mapName => {
      const normalizedMapName = mapName as ValidMapName;
      const mapData = MAP_POSITIONING_DATA[normalizedMapName];
      Object.keys(mapData.powerPositions.CT).forEach(area => {
        this.areaControl.set(`${normalizedMapName}_${area}`, {
          areaName: area,
          controllingTeam: 'none',
          controlStrength: 0,
          contestedBy: []
        });
      });
      Object.keys(mapData.powerPositions.T).forEach(area => {
        if (!this.areaControl.has(`${normalizedMapName}_${area}`)) {
          this.areaControl.set(`${normalizedMapName}_${area}`, {
            areaName: area,
            controllingTeam: 'none',
            controlStrength: 0,
            contestedBy: []
          });
        }
      });
    });
  }

  /**
   * Process GSI update for positioning analysis
   */
  async processGSIUpdate(
    gsiData: CSGO,
    gameState: GameStateSnapshot
  ): Promise<{
    playerPosition: PositionData;
    teammatePositions: TeammatePosition[];
    enemyPositions: EnemyPosition[];
    areaControl: AreaControl[];
    activeUtility: UtilityData[];
    context: PositionContext;
  }> {
    try {
      // Extract player position
      const playerPosition = this.extractPlayerPosition(gsiData);

      // Extract teammate positions
      const teammatePositions = this.extractTeammatePositions(gsiData);

      // Extract enemy positions
      const enemyPositions = this.extractEnemyPositions(gsiData);

      // Update area control
      this.updateAreaControl(
        gsiData.map?.name || '',
        playerPosition,
        teammatePositions,
        enemyPositions
      );

      // Update utility tracking
      this.updateUtilityTracking(gsiData);

      // Update role assignments
      this.updateRoleAssignments(gsiData, gameState);

      // Build position context
      const context = this.buildPositionContext(gsiData, gameState);

      // Update position history
      this.updatePositionHistory(playerPosition, gsiData.player?.steamid);

      // Store last update
      this.lastUpdate = gameState;

      return {
        playerPosition,
        teammatePositions,
        enemyPositions,
        areaControl: Array.from(this.areaControl.values()),
        activeUtility: this.activeUtility,
        context
      };

    } catch (error) {
      console.error('Error processing GSI update for positioning:', error);
      throw error;
    }
  }

  /**
   * Extract player position data from GSI
   */
  private extractPlayerPosition(gsiData: CSGO): PositionData {
    const player = gsiData.player as unknown as ExtendedPlayer;
    if (!player || !player.position || !player.forward) {
      throw new Error('Missing player position data in GSI');
    }

    return {
      x: player.position[0],
      y: player.position[1],
      z: player.position[2],
      angle: this.calculateAngle(player.forward[0], player.forward[1]),
      velocity: this.calculateVelocity(player.velocity || [0, 0, 0])
    };
  }

  /**
   * Extract teammate positions from GSI
   */
  private extractTeammatePositions(gsiData: CSGO): TeammatePosition[] {
    const teammates: TeammatePosition[] = [];
    const playerTeam = gsiData.player?.team?.side;

    if (!gsiData.players || !playerTeam) {
      return teammates;
    }

    gsiData.players.forEach((player) => {
      const extendedPlayer = player as unknown as ExtendedPlayer;
      if (extendedPlayer.team?.side === playerTeam && extendedPlayer.steamid !== gsiData.player?.steamid) {
        if (extendedPlayer.position && extendedPlayer.forward) {
          teammates.push({
            steamId: extendedPlayer.steamid,
            position: {
              x: extendedPlayer.position[0],
              y: extendedPlayer.position[1],
              z: extendedPlayer.position[2],
              angle: this.calculateAngle(extendedPlayer.forward[0], extendedPlayer.forward[1]),
              velocity: this.calculateVelocity(extendedPlayer.velocity || [0, 0, 0])
            },
            role: this.roleAssignments.get(extendedPlayer.steamid) || PlayerRole.SUPPORT,
            weapons: Object.values(extendedPlayer.weapons || {}).map(w => w.name || ''),
            utility: this.extractPlayerUtility(extendedPlayer)
          });
        }
      }
    });

    return teammates;
  }

  /**
   * Extract enemy positions from GSI
   */
  private extractEnemyPositions(gsiData: CSGO): EnemyPosition[] {
    const enemies: EnemyPosition[] = [];
    const playerTeam = gsiData.player?.team?.side;
    const currentTime = Date.now();

    if (!gsiData.players || !playerTeam) {
      return enemies;
    }

    gsiData.players.forEach((player) => {
      const extendedPlayer = player as unknown as ExtendedPlayer;
      if (extendedPlayer.team?.side !== playerTeam) {
        if (extendedPlayer.position) {
          // Enemy is visible
          enemies.push({
            steamId: extendedPlayer.steamid,
            position: {
              x: extendedPlayer.position[0],
              y: extendedPlayer.position[1],
              z: extendedPlayer.position[2],
              angle: this.calculateAngle(extendedPlayer.forward?.[0] || 0, extendedPlayer.forward?.[1] || 0),
              velocity: this.calculateVelocity(extendedPlayer.velocity || [0, 0, 0])
            },
            lastKnownTime: currentTime,
            confidence: 1.0
          });
        } else {
          // Check for last known position
          const lastState = this.lastUpdate?.raw.players?.find(p => p.steamid === extendedPlayer.steamid) as ExtendedPlayer | undefined;
          if (lastState?.position) {
            const timeDiff = currentTime - this.lastUpdate!.timestamp.getTime();
            const confidence = Math.max(0, 1 - (timeDiff / 5000)); // Decay over 5 seconds

            if (confidence > 0.1) { // Only include if somewhat recent
              enemies.push({
                steamId: extendedPlayer.steamid,
                position: {
                  x: lastState.position[0],
                  y: lastState.position[1],
                  z: lastState.position[2],
                  angle: this.calculateAngle(lastState.forward?.[0] || 0, lastState.forward?.[1] || 0),
                  velocity: this.calculateVelocity(lastState.velocity || [0, 0, 0])
                },
                lastKnownTime: this.lastUpdate!.timestamp.getTime(),
                confidence
              });
            }
          }
        }
      }
    });

    return enemies;
  }

  /**
   * Update area control based on player positions
   */
  private updateAreaControl(
    mapName: string,
    playerPosition: PositionData,
    teammatePositions: TeammatePosition[],
    enemyPositions: EnemyPosition[]
  ): void {
    if (!mapName) return;

    // Remove o prefixo 'de_' se existir e adiciona novamente para garantir o formato correto
    const normalizedMapName = `de_${mapName.replace('de_', '')}` as ValidMapName;
    
    if (!isValidMapName(normalizedMapName)) return;
    
    const mapData = MAP_POSITIONING_DATA[normalizedMapName];
    if (!mapData) return;

    // Reset control strengths
    this.areaControl.forEach(area => {
      area.controlStrength = 0;
      area.contestedBy = [];
    });

    // Calculate control for each area
    Object.entries(mapData.powerPositions).forEach(([side, positions]) => {
      (positions as string[]).forEach((position) => {
        const areaKey = `${mapName}_${position}`;
        const area = this.areaControl.get(areaKey);
        if (!area) return;

        // Check player control
        if (this.isPositionInArea(playerPosition, {
          center: this.parsePosition(position),
          radius: 300
        })) {
          area.controlStrength += 1;
          area.contestedBy.push('player');
        }

        // Check teammate control
        teammatePositions.forEach(teammate => {
          if (this.isPositionInArea(teammate.position, {
            center: this.parsePosition(position),
            radius: 300
          })) {
            area.controlStrength += 1;
            area.contestedBy.push(teammate.steamId);
          }
        });

        // Check enemy control
        enemyPositions.forEach(enemy => {
          if (this.isPositionInArea(enemy.position, {
            center: this.parsePosition(position),
            radius: 300
          })) {
            area.controlStrength -= enemy.confidence;
            area.contestedBy.push(enemy.steamId);
          }
        });
      });
    });
  }

  /**
   * Update utility tracking
   */
  private updateUtilityTracking(gsiData: CSGO): void {
    const currentTime = Date.now();

    // Remove expired utility
    this.activeUtility = this.activeUtility.filter(util => {
      const age = currentTime - util.lifetime;
      switch (util.type) {
        case 'smoke': return age < 15000; // 15 seconds
        case 'molotov': return age < 7000; // 7 seconds
        case 'flash': return age < 1000; // 1 second
        case 'he': return age < 1000; // 1 second
        default: return false;
      }
    });

    // Add new utility
    if (gsiData.grenades) {
      Object.values(gsiData.grenades).forEach((grenade) => {
        const extGrenade = grenade as unknown as ExtendedGrenade;
        if (!extGrenade.position) return;

        const utilType = extGrenade.type === 'inferno' ? 'molotov' : extGrenade.type;
        if (!['smoke', 'molotov', 'flash', 'he'].includes(utilType)) return;

        this.activeUtility.push({
          type: utilType as 'smoke' | 'molotov' | 'flash' | 'he',
          position: {
            x: extGrenade.position[0],
            y: extGrenade.position[1],
            z: extGrenade.position[2],
            angle: 0,
            velocity: 0
          },
          lifetime: currentTime,
          effectRadius: this.getUtilityRadius(utilType),
          thrownBy: extGrenade.owner || ''
        });
      });
    }
  }

  /**
   * Update role assignments based on player behavior
   */
  private updateRoleAssignments(gsiData: CSGO, gameState: GameStateSnapshot): void {
    if (!gsiData.players) return;

    gsiData.players.forEach(player => {
      if (!player.steamid) return;

      const currentRole = this.roleAssignments.get(player.steamid) || PlayerRole.SUPPORT;
      let newRole = currentRole;

      // Check for AWPer
      if (Object.values(player.weapons || {}).some(w => w.name === 'weapon_awp')) {
        newRole = PlayerRole.AWPER;
      }
      // Check for Entry based on position and timing
      else if (this.isEntryPosition(player, gameState)) {
        newRole = PlayerRole.ENTRY;
      }
      // Check for Lurker based on position relative to team
      else if (this.isLurking(player, gsiData)) {
        newRole = PlayerRole.LURKER;
      }
      // Check for Anchor based on position and round phase
      else if (this.isAnchoring(player, gameState)) {
        newRole = PlayerRole.ANCHOR;
      }

      this.roleAssignments.set(player.steamid, newRole);
    });
  }

  /**
   * Build position context from game state
   */
  private buildPositionContext(gsiData: CSGO, gameState: GameStateSnapshot): PositionContext {
    // Handle timeRemaining safely
    let timeRemaining = 0;
    if (gameState && gameState.processed && typeof gameState.processed.timeRemaining === 'number') {
      timeRemaining = gameState.processed.timeRemaining;
    }
    
    const context: PositionContext = {
      mapName: gsiData.map?.name || '',
      phase: (gsiData.phase_countdowns?.phase || '') as GameContext,
      teamSide: gsiData.player?.team?.side || 'CT',
      bombPlanted: gsiData.round?.bomb === 'planted',
      bombsite: (gsiData.round as ExtendedRound)?.bomb_site,
      playerRole: this.roleAssignments.get(gsiData.player?.steamid || '') || PlayerRole.SUPPORT,
      aliveTeammates: this.countAliveTeammates(gsiData),
      aliveEnemies: this.countAliveEnemies(gsiData),
      roundTime: timeRemaining
    };

    return context;
  }

  /**
   * Update position history
   */
  private updatePositionHistory(position: PositionData, steamId?: string): void {
    if (!steamId) return;

    const history = this.positionHistory.get(steamId) || [];
    history.push(position);

    // Keep last 10 positions
    if (history.length > 10) {
      history.shift();
    }

    this.positionHistory.set(steamId, history);
  }

  // ===== Utility Methods =====

  private calculateAngle(x: number, y: number): number {
    return Math.atan2(y, x) * (180 / Math.PI);
  }

  private calculateVelocity(velocity: number[]): number {
    return Math.sqrt(velocity[0] * velocity[0] + velocity[1] * velocity[1]);
  }

  private extractPlayerUtility(player: Player): string[] {
    const utility: string[] = [];
    player.weapons?.forEach(weapon => {
      if (['flashbang', 'smokegrenade', 'hegrenade', 'molotov', 'incgrenade'].includes(weapon.name || '')) {
        utility.push(weapon.name || '');
      }
    });
    return utility;
  }

  /**
   * Check if a position is within a defined area on the map
   * @param position Player position to check
   * @param areaCoords Area coordinates and bounds
   * @returns true if position is within the area
   */
  private isPositionInArea(position: PositionData, areaCoords: {
    center: [number, number, number],
    radius?: number,
    bounds?: {
      min: [number, number, number],
      max: [number, number, number]
    }
  }): boolean {
    // If radius is defined, check if position is within circular area
    if (areaCoords.radius) {
      const dx = position.x - areaCoords.center[0];
      const dy = position.y - areaCoords.center[1];
      const dz = position.z - areaCoords.center[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance <= areaCoords.radius;
    }
    
    // If bounds are defined, check if position is within rectangular area
    if (areaCoords.bounds) {
      return position.x >= areaCoords.bounds.min[0] &&
             position.x <= areaCoords.bounds.max[0] &&
             position.y >= areaCoords.bounds.min[1] &&
             position.y <= areaCoords.bounds.max[1] &&
             position.z >= areaCoords.bounds.min[2] &&
             position.z <= areaCoords.bounds.max[2];
    }

    // If no radius or bounds defined, use a default radius of 200 units
    const dx = position.x - areaCoords.center[0];
    const dy = position.y - areaCoords.center[1];
    const dz = position.z - areaCoords.center[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance <= 200;
  }

  private getUtilityRadius(type: string): number {
    switch (type) {
      case 'smoke': return 144; // Units
      case 'molotov': return 120;
      case 'flash': return 180;
      case 'he': return 100;
      default: return 0;
    }
  }

  /**
   * Detect if a player is in an entry position/role
   * Entry fraggers are typically:
   * - First into contested areas
   * - Close to enemy territory
   * - Have appropriate utility (flashes)
   * - Moving at high velocity
   */
  private isEntryPosition(player: ExtendedPlayer, gameState: GameStateSnapshot): boolean {
    if (!player || !player.position || !player.weapons || !player.state) {
      return false;
    }

    // Check if early in the round (first 30 seconds)
    const isEarlyRound = gameState.processed.timeRemaining !== undefined && gameState.processed.timeRemaining >= 85;
    if (!isEarlyRound) return false;

    // Check if player has appropriate utility
    const hasFlashes = Object.values(player.weapons).some(
      (w: any) => w.name === 'weapon_flashbang'
    );

    // Check velocity (entry fraggers move fast)
    const velocity = player.velocity ? 
      Math.sqrt(player.velocity[0] * player.velocity[0] + player.velocity[1] * player.velocity[1]) : 0;
    const isMovingFast = velocity > 200;

    // Check if player is near the front of the team
    const isLeading = this.isLeadingTeam(player, gameState.raw.players);

    // Check weapon type (typically not AWP)
    const hasRifleOrSMG = Object.values(player.weapons).some((w: any) => {
      const name = w.name || '';
      return name.includes('rifle') || name.includes('smg');
    });

    // Combine factors
    return isEarlyRound && hasFlashes && isMovingFast && isLeading && hasRifleOrSMG;
  }

  /**
   * Detect if a player is lurking
   * Lurkers are typically:
   * - Isolated from team
   * - In or near enemy territory
   * - Moving slowly or stationary
   * - Away from the main objective
   */
  private isLurking(player: ExtendedPlayer, gsiData: CSGO): boolean {
    if (!player || !player.position || !player.state) {
      return false;
    }

    // Calculate distance to nearest teammate
    const minTeammateDistance = this.getMinTeammateDistance(player, gsiData);
    const isIsolated = minTeammateDistance > 1000; // Units

    // Check if in enemy territory
    const isInEnemyTerritory = this.isInEnemyTerritory(player, gsiData);

    // Check movement speed
    const velocity = player.velocity ? 
      Math.sqrt(player.velocity[0] * player.velocity[0] + player.velocity[1] * player.velocity[1]) : 0;
    const isMovingSlow = velocity < 100;

    // Check distance from objective (bomb sites)
    const isAwayFromObjective = this.isAwayFromObjectives(player, gsiData);

    // Combine factors
    return isIsolated && isInEnemyTerritory && isMovingSlow && isAwayFromObjective;
  }

  /**
   * Detect if a player is anchoring
   * Anchors are typically:
   * - Holding defensive positions
   * - Near bomb sites (CT) or map control points
   * - Stationary or moving minimally
   * - Have utility for delay
   */
  private isAnchoring(player: ExtendedPlayer, gameState: GameStateSnapshot): boolean {
    if (!player || !player.position || !player.team) {
      return false;
    }

    // Only CTs can anchor
    if (player.team.side !== 'CT') {
      return false;
    }

    // Check if in defensive position
    const isDefensivePosition = this.isInDefensivePosition(player, gameState.raw.players);

    // Check utility for delay
    const hasUtility = player.weapons.some(w => 
      ['weapon_smokegrenade', 'weapon_molotov', 'weapon_incgrenade'].includes(w.name || '')
    );

    // Check if alone at site
    const nearbyTeammates = this.countNearbyTeammates(player, gameState.raw.players);

    return isDefensivePosition && hasUtility && nearbyTeammates <= 1;
  }

  /**
   * Helper: Check if player is leading their team
   */
  private isLeadingTeam(player: ExtendedPlayer, players: Player[]): boolean {
    if (!player || !player.position) {
      return false;
    }

    const playerTeam = player.team?.side;
    if (!playerTeam) {
      return false;
    }

    // Get average position of team
    let teamX = 0, teamY = 0, teamCount = 0;
    players.forEach(p => {
      const extendedPlayer = p as unknown as ExtendedPlayer;
      if (extendedPlayer.team?.side === playerTeam && extendedPlayer.position && extendedPlayer.steamid !== player.steamid) {
        teamX += extendedPlayer.position[0];
        teamY += extendedPlayer.position[1];
        teamCount++;
      }
    });

    if (teamCount === 0) {
      return false;
    }

    const avgX = teamX / teamCount;
    const avgY = teamY / teamCount;

    // Check if player is ahead of team average
    const playerPos = player.position;
    const dx = playerPos[0] - avgX;
    const dy = playerPos[1] - avgY;
    const distanceFromTeam = Math.sqrt(dx * dx + dy * dy);

    return distanceFromTeam > 300; // More than 300 units ahead
  }

  /**
   * Helper: Get minimum distance to teammates
   */
  private getMinTeammateDistance(player: ExtendedPlayer, gsiData: CSGO): number {
    if (!player || !player.position) {
      return Infinity;
    }

    let minDistance = Infinity;
    const playerTeam = player.team?.side;
    const playerPos = player.position;

    gsiData.players.forEach(p => {
      const extendedPlayer = p as unknown as ExtendedPlayer;
      if (extendedPlayer.team?.side === playerTeam && extendedPlayer.position && extendedPlayer.steamid !== player.steamid) {
        const dx = playerPos[0] - extendedPlayer.position[0];
        const dy = playerPos[1] - extendedPlayer.position[1];
        const dz = playerPos[2] - extendedPlayer.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        minDistance = Math.min(minDistance, distance);
      }
    });

    return minDistance;
  }

  /**
   * Helper: Check if player is in enemy territory
   */
  private isInEnemyTerritory(player: ExtendedPlayer, gsiData: CSGO): boolean {
    if (!player || !player.position || !gsiData.map?.name) {
      return false;
    }

    const normalizedMapName = `de_${gsiData.map.name.replace('de_', '')}` as ValidMapName;
    if (!isValidMapName(normalizedMapName)) {
      return false;
    }

    const mapData = MAP_POSITIONING_DATA[normalizedMapName];
    const enemyPositions = player.team?.side === 'CT' ? 
      mapData.powerPositions.T : 
      mapData.powerPositions.CT;

    // Check if player is near any enemy power position
    return enemyPositions.some(pos => {
      // Parse position string into coordinates
      const [x, y, z] = this.parsePosition(pos);
      return this.isPositionInArea(
        {
          x: player.position![0],
          y: player.position![1],
          z: player.position![2],
          angle: 0,
          velocity: 0
        },
        { center: [x, y, z], radius: 500 }
      );
    });
  }

  /**
   * Helper: Check if player is away from objectives
   */
  private isAwayFromObjectives(player: ExtendedPlayer, gsiData: CSGO): boolean {
    if (!player || !player.position || !gsiData.map?.name) {
      return false;
    }

    const normalizedMapName = `de_${gsiData.map.name.replace('de_', '')}` as ValidMapName;
    if (!isValidMapName(normalizedMapName)) {
      return false;
    }

    const mapData = MAP_POSITIONING_DATA[normalizedMapName];
    // Get bomb site positions from CT power positions (since bomb sites are typically CT-controlled)
    const sitePositions = mapData.powerPositions.CT;

    // Check distance to nearest site
    let minSiteDistance = Infinity;
    sitePositions.forEach(pos => {
      // Parse position string into coordinates
      const [x, y, z] = this.parsePosition(pos);
      const dx = player.position![0] - x;
      const dy = player.position![1] - y;
      const dz = player.position![2] - z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      minSiteDistance = Math.min(minSiteDistance, distance);
    });

    return minSiteDistance > 1500; // Units
  }

  /**
   * Helper: Check if player is in a defensive position
   */
  private isInDefensivePosition(player: ExtendedPlayer, players: Player[]): boolean {
    if (!player || !player.position || !player.team) {
      return false;
    }

    // Check if near defensive position
    const isNearDefensiveSpot = this.isNearDefensiveSpot(player);

    // Check if has good cover
    const hasCover = this.hasGoodCover(player);

    // Check if watching common entry point
    const isWatchingEntry = this.isWatchingEntryPoint(player);

    return isNearDefensiveSpot && hasCover && isWatchingEntry;
  }

  private isNearDefensiveSpot(player: ExtendedPlayer): boolean {
    if (!player || !player.position || !player.team) {
      return false;
    }

    // Implementation details...
    return true;
  }

  private hasGoodCover(player: ExtendedPlayer): boolean {
    if (!player || !player.position || !player.team) {
      return false;
    }

    // Implementation details...
    return true;
  }

  private isWatchingEntryPoint(player: ExtendedPlayer): boolean {
    if (!player || !player.position || !player.team) {
      return false;
    }

    // Implementation details...
    return true;
  }

  private countAliveTeammates(gsiData: CSGO): number {
    const playerTeam = gsiData.player?.team?.side;
    if (!gsiData.players || !playerTeam) return 0;

    return gsiData.players.filter((player) => {
      const extendedPlayer = player as unknown as ExtendedPlayer;
      return extendedPlayer.team?.side === playerTeam && 
             extendedPlayer.steamid !== gsiData.player?.steamid && 
             extendedPlayer.state?.health > 0;
    }).length;
  }

  private countAliveEnemies(gsiData: CSGO): number {
    const playerTeam = gsiData.player?.team?.side;
    if (!gsiData.players || !playerTeam) return 0;

    return gsiData.players.filter((player) => {
      const extendedPlayer = player as unknown as ExtendedPlayer;
      return extendedPlayer.team?.side !== playerTeam && extendedPlayer.state?.health > 0;
    }).length;
  }

  private countNearbyTeammates(player: ExtendedPlayer, players: Player[]): number {
    if (!player || !player.position) {
      return 0;
    }

    const playerTeam = player.team?.side;
    if (!playerTeam) {
      return 0;
    }

    let count = 0;
    players.forEach(p => {
      const extendedPlayer = p as unknown as ExtendedPlayer;
      if (extendedPlayer.team?.side === playerTeam && 
          extendedPlayer.position && 
          extendedPlayer.steamid !== player.steamid) {
        const dx = player.position![0] - extendedPlayer.position[0];
        const dy = player.position![1] - extendedPlayer.position[1];
        const dz = player.position![2] - extendedPlayer.position[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distance < 500) { // Within 500 units
          count++;
        }
      }
    });

    return count;
  }

  private parsePosition(positionString: string): [number, number, number] {
    // This is a placeholder - you'll need to implement the actual parsing logic
    // based on how your position strings are formatted
    return [0, 0, 0];
  }
} 