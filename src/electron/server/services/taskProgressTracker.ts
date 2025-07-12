/**
 * Task Progress Tracker Service
 * 
 * Integrates Game State Integration (GSI) events with the task generation system
 * to provide real-time task progress tracking and automatic completion detection.
 */

import { EventEmitter } from 'events';
import { CSGO, CSGORaw } from 'csgogsi';
import { GSI } from '../sockets/GSI.js';
import { TaskGenerationService, GeneratedTask, TaskStatus } from './taskGenerationServices.js';
import { MemoryService } from '../ai/memory/MemoryService.js';
import { TaskCriteria } from '../../../types/performance.js';

export interface GameEvent {
  type: string;
  data: any;
  timestamp: Date;
  playerId: string;
  roundNumber?: number;
  mapName?: string;
  teamSide?: 'CT' | 'T';
}

export interface PlayerGameState {
  steamId: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  money: number;
  health: number;
  armor: number;
  weapons: string[];
  position: { x: number, y: number, z: number };
  teamSide: 'CT' | 'T';
  isAlive: boolean;
  flashAssists: number;
  utilityDamage: number;
}

export class TaskProgressTracker extends EventEmitter {
  private taskGenerationService: TaskGenerationService;
  private memoryService: MemoryService;
  private lastGameState: CSGO | null = null;
  private playerStates: Map<string, PlayerGameState> = new Map();
  private roundEvents: GameEvent[] = [];
  private currentRound: number = 0;
  private isRoundActive: boolean = false;

  constructor(taskGenerationService: TaskGenerationService, memoryService: MemoryService) {
    super();
    this.taskGenerationService = taskGenerationService;
    this.memoryService = memoryService;
    this.setupGSIListeners();
  }

  /**
   * Setup GSI event listeners for real-time game state tracking
   */
  private setupGSIListeners(): void {
    console.log('🎯 Setting up GSI listeners for task progress tracking');

    // Listen for raw GSI data updates
    GSI.on('data', (gameState: CSGO) => {
      this.processGameStateUpdate(gameState);
    });

    // Listen for round start events
    GSI.on('roundStart', () => {
      this.handleRoundStart();
    });

    // Listen for round end events
    GSI.on('roundEnd', (data: any) => {
      this.handleRoundEnd(data);
    });

    // Listen for bomb events
    GSI.on('bombPlant', (data: any) => {
      this.handleBombEvent('bomb_plant', data);
    });

    GSI.on('bombDefuse', (data: any) => {
      this.handleBombEvent('bomb_defuse', data);
    });

    // Listen for kill events (we'll need to detect these from player state changes)
    console.log('✅ GSI listeners configured for task progress tracking');
  }

  /**
   * Process game state updates and detect events for task progress
   */
  private processGameStateUpdate(gameState: CSGO): void {
    if (!gameState || !gameState.map || !gameState.players) {
      return;
    }

    const currentTime = new Date();

    // Update round tracking
    if (gameState.map.round !== this.currentRound) {
      this.currentRound = gameState.map.round;
      this.isRoundActive = gameState.map.phase === 'live';
    }

    // Process each player's state changes
    for (const player of gameState.players) {
      if (!player.steamid) continue;

      const newState = this.extractPlayerState(player, gameState);
      const oldState = this.playerStates.get(player.steamid);

      if (oldState) {
        this.detectPlayerEvents(player.steamid, oldState, newState, currentTime);
      }

      this.playerStates.set(player.steamid, newState);
    }

    this.lastGameState = gameState;
  }

  /**
   * Extract player state from game data
   */
  private extractPlayerState(player: any, gameState: CSGO): PlayerGameState {
    return {
      steamId: player.steamid,
      kills: player.state?.round_kills || 0,
      deaths: player.state?.deaths || 0,
      assists: player.state?.assists || 0,
      adr: player.state?.adr || 0,
      money: player.state?.money || 0,
      health: player.state?.health || 0,
      armor: player.state?.armor || 0,
      weapons: player.weapons ? Object.keys(player.weapons) : [],
      position: player.position || { x: 0, y: 0, z: 0 },
      teamSide: player.team as 'CT' | 'T',
      isAlive: (player.state?.health || 0) > 0,
      flashAssists: player.state?.round_flash_assists || 0,
      utilityDamage: player.state?.utility_damage || 0
    };
  }

  /**
   * Detect events from player state changes
   */
  private async detectPlayerEvents(
    steamId: string,
    oldState: PlayerGameState,
    newState: PlayerGameState,
    timestamp: Date
  ): Promise<void> {
    const events: GameEvent[] = [];

    // Detect kills
    if (newState.kills > oldState.kills) {
      const killCount = newState.kills - oldState.kills;
      events.push({
        type: 'player_kill',
        data: { 
          count: killCount,
          totalKills: newState.kills,
          weapon: this.getActiveWeapon(newState.weapons),
          isHeadshot: false // We'd need more detailed GSI data for this
        },
        timestamp,
        playerId: steamId,
        roundNumber: this.currentRound,
        mapName: this.lastGameState?.map?.name,
        teamSide: newState.teamSide
      });
    }

    // Detect assists
    if (newState.assists > oldState.assists) {
      events.push({
        type: 'player_assist',
        data: { 
          count: newState.assists - oldState.assists,
          totalAssists: newState.assists
        },
        timestamp,
        playerId: steamId,
        roundNumber: this.currentRound,
        mapName: this.lastGameState?.map?.name,
        teamSide: newState.teamSide
      });
    }

    // Detect flash assists
    if (newState.flashAssists > oldState.flashAssists) {
      events.push({
        type: 'flash_assist',
        data: { 
          count: newState.flashAssists - oldState.flashAssists,
          totalFlashAssists: newState.flashAssists
        },
        timestamp,
        playerId: steamId,
        roundNumber: this.currentRound,
        mapName: this.lastGameState?.map?.name,
        teamSide: newState.teamSide
      });
    }

    // Detect utility damage
    if (newState.utilityDamage > oldState.utilityDamage) {
      events.push({
        type: 'utility_damage',
        data: { 
          damage: newState.utilityDamage - oldState.utilityDamage,
          totalUtilityDamage: newState.utilityDamage
        },
        timestamp,
        playerId: steamId,
        roundNumber: this.currentRound,
        mapName: this.lastGameState?.map?.name,
        teamSide: newState.teamSide
      });
    }

    // Detect money save (eco rounds)
    if (this.isEcoRound(newState) && newState.isAlive && !oldState.isAlive) {
      events.push({
        type: 'money_save',
        data: { 
          savedMoney: newState.money,
          isEcoRound: true
        },
        timestamp,
        playerId: steamId,
        roundNumber: this.currentRound,
        mapName: this.lastGameState?.map?.name,
        teamSide: newState.teamSide
      });
    }

    // Process all detected events
    for (const event of events) {
      await this.processGameEvent(event);
    }
  }

  /**
   * Process a game event and update task progress
   */
  private async processGameEvent(event: GameEvent): Promise<void> {
    try {
      console.log(`🎮 Processing game event: ${event.type} for player ${event.playerId}`);
      
      // Update task progress via the task generation service
      const updates = await this.taskGenerationService.updateTaskProgress(event.playerId, event);
      
      if (updates.length > 0) {
        console.log(`✅ Updated ${updates.length} tasks for player ${event.playerId}`);
        
        // Emit progress update event
        this.emit('taskProgressUpdated', {
          playerId: event.playerId,
          event,
          updates
        });

        // Check for completed tasks
        const completedTasks = updates.filter(update => update.completed);
        if (completedTasks.length > 0) {
          console.log(`🏆 ${completedTasks.length} tasks completed for player ${event.playerId}`);
          this.emit('tasksCompleted', {
            playerId: event.playerId,
            completedTasks,
            event
          });
        }
      }
    } catch (error) {
      console.error('❌ Error processing game event:', error);
      this.emit('error', { error, event });
    }
  }

  /**
   * Handle round start events
   */
  private handleRoundStart(): void {
    console.log(`🔄 Round ${this.currentRound + 1} started`);
    this.isRoundActive = true;
    this.roundEvents = [];
    
    // Reset round-based player stats
    for (const [steamId, state] of this.playerStates.entries()) {
      state.kills = 0;
      state.assists = 0;
      state.flashAssists = 0;
      state.utilityDamage = 0;
    }

    this.emit('roundStart', { roundNumber: this.currentRound });
  }

  /**
   * Handle round end events
   */
  private handleRoundEnd(data: any): void {
    console.log(`🏁 Round ${this.currentRound} ended`);
    this.isRoundActive = false;

    // Process end-of-round events for all players
    this.processEndOfRoundEvents(data);

    this.emit('roundEnd', { 
      roundNumber: this.currentRound, 
      events: this.roundEvents,
      data 
    });
  }

  /**
   * Handle bomb-related events
   */
  private async handleBombEvent(eventType: string, data: any): Promise<void> {
    if (!data.player?.steamid) return;

    const event: GameEvent = {
      type: eventType,
      data: {
        site: data.site || 'unknown',
        timeLeft: data.timeLeft || 0
      },
      timestamp: new Date(),
      playerId: data.player.steamid,
      roundNumber: this.currentRound,
      mapName: this.lastGameState?.map?.name,
      teamSide: data.player.team
    };

    await this.processGameEvent(event);
  }

  /**
   * Process end-of-round events for task completion
   */
  private async processEndOfRoundEvents(roundData: any): Promise<void> {
    // Check for round-specific achievements like clutches, multi-kills, etc.
    for (const [steamId, state] of this.playerStates.entries()) {
      // Detect clutch situations (1vX wins)
      if (this.isClutchSituation(steamId, roundData)) {
        const event: GameEvent = {
          type: 'clutch_win',
          data: {
            enemies: this.getEnemyCount(steamId),
            roundWin: true
          },
          timestamp: new Date(),
          playerId: steamId,
          roundNumber: this.currentRound,
          mapName: this.lastGameState?.map?.name,
          teamSide: state.teamSide
        };

        await this.processGameEvent(event);
      }

      // Detect multi-kills
      if (state.kills >= 2) {
        const event: GameEvent = {
          type: 'multi_kill',
          data: {
            killCount: state.kills,
            type: this.getMultiKillType(state.kills)
          },
          timestamp: new Date(),
          playerId: steamId,
          roundNumber: this.currentRound,
          mapName: this.lastGameState?.map?.name,
          teamSide: state.teamSide
        };

        await this.processGameEvent(event);
      }
    }
  }

  // ===== Helper Methods =====

  private getActiveWeapon(weapons: string[]): string {
    // Return the primary weapon, preferring rifles > pistols > knives
    const rifles = weapons.filter(w => w.includes('ak47') || w.includes('m4') || w.includes('awp'));
    if (rifles.length > 0) return rifles[0];
    
    const pistols = weapons.filter(w => w.includes('glock') || w.includes('usp') || w.includes('p250'));
    if (pistols.length > 0) return pistols[0];
    
    return weapons[0] || 'unknown';
  }

  private isEcoRound(state: PlayerGameState): boolean {
    return state.money < 2000; // Simple eco detection
  }

  private isClutchSituation(steamId: string, roundData: any): boolean {
    if (!this.lastGameState || !roundData) return false;

    // Get the player's team
    const player = this.lastGameState.players.find(p => p.steamid === steamId);
    if (!player) return false;

    const playerTeam = player.team.side;
    const enemyTeam = playerTeam === 'CT' ? 'T' : 'CT';

    // Count alive teammates and enemies
    const aliveTeammates = this.lastGameState.players.filter(p => 
      p.team.side === playerTeam && 
      p.steamid !== steamId && 
      p.state.health > 0
    ).length;

    const aliveEnemies = this.lastGameState.players.filter(p => 
      p.team.side === enemyTeam && 
      p.state.health > 0
    ).length;

    // It's a clutch if player is alone against 1 or more enemies
    return aliveTeammates === 0 && aliveEnemies > 0;
  }

  private getEnemyCount(steamId: string): number {
    if (!this.lastGameState) return 0;

    // Get the player's team
    const player = this.lastGameState.players.find(p => p.steamid === steamId);
    if (!player) return 0;

    const enemyTeam = player.team.side === 'CT' ? 'T' : 'CT';

    // Count alive enemies
    return this.lastGameState.players.filter(p => 
      p.team.side === enemyTeam && 
      p.state.health > 0
    ).length;
  }

  private getMultiKillType(killCount: number): string {
    switch (killCount) {
      case 2: return 'double_kill';
      case 3: return 'triple_kill';
      case 4: return 'quadruple_kill';
      case 5: return 'ace';
      default: return 'multi_kill';
    }
  }

  /**
   * Start the task progress tracker
   */
  public start(): void {
    console.log('🚀 Task Progress Tracker started');
    this.emit('started');
  }

  /**
   * Stop the task progress tracker
   */
  public stop(): void {
    console.log('⏹️ Task Progress Tracker stopped');
    this.emit('stopped');
  }

  /**
   * Get current tracking statistics
   */
  public getStats(): any {
    return {
      isActive: this.isRoundActive,
      currentRound: this.currentRound,
      playersTracked: this.playerStates.size,
      eventsThisRound: this.roundEvents.length,
      lastUpdate: new Date()
    };
  }

  /**
   * Check if a task criteria is met for a given event
   * @param criteria - Task completion criteria
   * @param event - Game event to check against
   * @param currentProgress - Current progress data
   * @returns Whether the criteria is satisfied
   */
  private async checkTaskCriteria(
    criteria: TaskCriteria,
    event: GameEvent,
    currentProgress: any
  ): Promise<boolean> {
    try {
      // Parse criteria if it's a string
      const parsedCriteria = typeof criteria === 'string' ? JSON.parse(criteria) : criteria;
      
      // Check event type match
      if (parsedCriteria.eventType && parsedCriteria.eventType !== event.type) {
        return false;
      }
      
      // Check specific criteria based on event type
      switch (event.type) {
        case 'player_kill':
          if (parsedCriteria.killCount) {
            const currentKills = (currentProgress.kills || 0) + (event.data.count || 1);
            return currentKills >= parsedCriteria.killCount;
          }
          if (parsedCriteria.weapon && event.data.weapon !== parsedCriteria.weapon) {
            return false;
          }
          break;
          
        case 'bomb_plant':
          if (parsedCriteria.site && event.data.site !== parsedCriteria.site) {
            return false;
          }
          break;
          
        case 'flash_assist':
          if (parsedCriteria.assistCount) {
            const currentAssists = (currentProgress.assists || 0) + (event.data.count || 1);
            return currentAssists >= parsedCriteria.assistCount;
          }
          break;
          
        case 'round_win':
          if (parsedCriteria.winCondition && event.data.condition !== parsedCriteria.winCondition) {
            return false;
          }
          break;
          
        default:
          // For other event types, check generic conditions
          break;
      }
      
      // Check map-specific criteria
      if (parsedCriteria.mapName && event.mapName !== parsedCriteria.mapName) {
        return false;
      }
      
      // Check team side criteria
      if (parsedCriteria.teamSide && event.teamSide !== parsedCriteria.teamSide) {
        return false;
      }
      
      // Check time-based criteria
      if (parsedCriteria.timeLimit) {
        const taskCreatedTime = new Date(currentProgress.created_at || Date.now());
        const timePassed = Date.now() - taskCreatedTime.getTime();
        if (timePassed > parsedCriteria.timeLimit * 1000) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking task criteria:', error);
      return false;
    }
  }

  /**
   * Calculate progress percentage for a task
   * @param task - The task to calculate progress for
   * @param events - Recent events for the player
   * @returns Progress percentage (0-100)
   */
  private calculateTaskProgress(task: any, events: GameEvent[]): number {
    try {
      const criteria = typeof task.completion_criteria === 'string' 
        ? JSON.parse(task.completion_criteria) 
        : task.completion_criteria;
      
      // Parse current progress
      const currentProgress = typeof task.progress === 'string' 
        ? JSON.parse(task.progress) 
        : task.progress;
      
      // Calculate progress based on criteria type
      if (criteria.killCount) {
        const currentKills = currentProgress.kills || 0;
        return Math.min(100, (currentKills / criteria.killCount) * 100);
      }
      
      if (criteria.assistCount) {
        const currentAssists = currentProgress.assists || 0;
        return Math.min(100, (currentAssists / criteria.assistCount) * 100);
      }
      
      if (criteria.roundWins) {
        const currentWins = currentProgress.roundWins || 0;
        return Math.min(100, (currentWins / criteria.roundWins) * 100);
      }
      
      // For boolean criteria (bomb plant, defuse, etc.)
      if (criteria.eventType && ['bomb_plant', 'bomb_defuse', 'clutch_win'].includes(criteria.eventType)) {
        return currentProgress.completed ? 100 : 0;
      }
      
      // Default progress calculation
      const totalSteps = criteria.totalSteps || 1;
      const completedSteps = currentProgress.completedSteps || 0;
      return Math.min(100, (completedSteps / totalSteps) * 100);
    } catch (error) {
      console.error('Error calculating task progress:', error);
      return 0;
    }
  }
}

/**
 * Create and initialize the task progress tracker
 */
export async function createTaskProgressTracker(
  taskGenerationService: TaskGenerationService,
  memoryService: MemoryService
): Promise<TaskProgressTracker> {
  const tracker = new TaskProgressTracker(taskGenerationService, memoryService);
  tracker.start();
  
  console.log('✅ Task Progress Tracker created and started');
  return tracker;
}

export default TaskProgressTracker;