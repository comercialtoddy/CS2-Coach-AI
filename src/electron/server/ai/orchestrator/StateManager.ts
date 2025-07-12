/**
 * Dynamic State Management System
 * 
 * This module maintains and updates the AI's internal state based on ingested GSI data,
 * ensuring it accurately reflects the current game context with sophisticated pattern
 * detection, persistence mechanisms, and efficient state retrieval.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  GameStateSnapshot,
  Pattern,
  IStateManager,
  GameContext,
  SituationalFactor,
  PlayerGameState,
  TeamGameState
} from './OrchestratorArchitecture.js';
import { MemoryService } from '../memory/MemoryService.js';
import { MemoryType, MemoryImportance, SessionDataMemory } from '../interfaces/MemoryService.js';

// ===== State Management Configuration =====

/**
 * Configuration for state management behavior
 */
export interface StateManagerConfig {
  maxHistorySize: number;           // Maximum number of states to keep in memory
  persistenceInterval: number;      // Interval between automatic saves (ms)
  patternDetectionEnabled: boolean; // Enable automatic pattern detection
  compressionEnabled: boolean;      // Enable state compression for storage
  stateValidationEnabled: boolean;  // Enable state validation
  debugMode: boolean;              // Enable debug logging
  autoCleanupEnabled: boolean;     // Enable automatic cleanup of old states
  cleanupThreshold: number;        // Age threshold for cleanup (ms)
}

/**
 * Default state manager configuration
 */
const DEFAULT_CONFIG: StateManagerConfig = {
  maxHistorySize: 1000,
  persistenceInterval: 30000,       // 30 seconds
  patternDetectionEnabled: true,
  compressionEnabled: true,
  stateValidationEnabled: true,
  debugMode: false,
  autoCleanupEnabled: true,
  cleanupThreshold: 3600000         // 1 hour
};

// ===== State Analysis Structures =====

/**
 * State change information
 */
export interface StateChange {
  id: string;
  timestamp: Date;
  from: GameStateSnapshot | null;
  to: GameStateSnapshot;
  changeType: 'round_start' | 'round_end' | 'phase_change' | 'critical_event' | 'normal_update';
  significance: 'low' | 'medium' | 'high' | 'critical';
  affectedAreas: string[];
  metrics: {
    healthChange: number;
    economyChange: number;
    positionChange: number;
    performanceChange: number;
  };
}

/**
 * Comprehensive pattern analysis result
 */
export interface PatternAnalysisResult {
  patterns: Pattern[];
  confidence: number;                    // 0-1
  recommendations: string[];
  insights: {
    playerBehavior: string[];
    teamDynamics: string[];
    economicTrends: string[];
    tacticalPatterns: string[];
  };
  alertLevel: 'normal' | 'attention' | 'warning' | 'critical';
}

/**
 * State compression result for storage optimization
 */
export interface CompressedState {
  id: string;
  timestamp: Date;
  essentialData: {
    context: GameContext;
    playerHealth: number;
    playerMoney: number;
    teamScore: number;
    round: number;
    situationalFactors: SituationalFactor[];
  };
  compressionRatio: number;
  originalSize: number;
}

/**
 * State metrics for performance monitoring
 */
export interface StateMetrics {
  totalStates: number;
  averageProcessingTime: number;
  patternDetectionRate: number;
  compressionEfficiency: number;
  memoryUsage: number;
  lastUpdate: Date;
  errorRate: number;
}

// ===== Main State Manager Implementation =====

/**
 * Dynamic State Manager
 * 
 * Manages the AI's internal state with sophisticated tracking, pattern detection,
 * and persistence capabilities for optimal decision making.
 */
export class DynamicStateManager extends EventEmitter implements IStateManager {
  private currentState: GameStateSnapshot | null = null;
  private stateHistory: GameStateSnapshot[] = [];
  private compressedHistory: CompressedState[] = [];
  private stateChanges: StateChange[] = [];
  private detectedPatterns: Map<string, Pattern> = new Map();
  private config: StateManagerConfig;
  private memoryService: MemoryService | null = null;
  private persistenceTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metrics: StateMetrics;
  private initialized: boolean = false;

  constructor(config: Partial<StateManagerConfig> = {}, memoryService?: MemoryService) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryService = memoryService || null;
    
    this.metrics = {
      totalStates: 0,
      averageProcessingTime: 0,
      patternDetectionRate: 0,
      compressionEfficiency: 0,
      memoryUsage: 0,
      lastUpdate: new Date(),
      errorRate: 0
    };

    if (this.config.debugMode) {
      console.log('🏗️ DynamicStateManager initialized with config:', this.config);
    }
  }

  // ===== Lifecycle Management =====

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️ StateManager already initialized');
      return;
    }

    console.log('🚀 Initializing DynamicStateManager...');

    try {
      // Load persisted state if available
      await this.loadState();

      // Start background processes
      this.startBackgroundProcesses();

      this.initialized = true;
      this.emit('initialized');
      
      console.log('✅ DynamicStateManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize StateManager:', error);
      throw error;
    }
  }

  /**
   * Dispose of the state manager
   */
  async dispose(): Promise<void> {
    console.log('🛑 Disposing DynamicStateManager...');

    this.initialized = false;

    // Stop background processes
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = undefined;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Final persistence
    await this.persistState();

    this.emit('disposed');
    console.log('✅ DynamicStateManager disposed successfully');
  }

  // ===== Core State Management =====

  /**
   * Update the current game state with comprehensive analysis
   */
  async updateGameState(snapshot: GameStateSnapshot): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();

      // Validate incoming state
      if (this.config.stateValidationEnabled && !this.validateState(snapshot)) {
        throw new Error('Invalid game state snapshot provided');
      }

      // Create state change record
      const stateChange = this.createStateChange(this.currentState, snapshot);
      
      // Update current state
      const previousState = this.currentState;
      this.currentState = snapshot;

      // Add to history with size management
      this.addToHistory(snapshot);

      // Record state change
      this.stateChanges.push(stateChange);
      this.limitStateChanges();

      // Emit events
      this.emit('state-updated', snapshot, previousState);
      this.emit('state-change', stateChange);

      // Perform pattern detection if enabled
      if (this.config.patternDetectionEnabled) {
        await this.performPatternDetection();
      }

      // Update session data in memory service if available
      if (this.memoryService) {
        await this.updateSessionMemory();
      }

      // Update metrics
      this.updateMetrics(Date.now() - startTime);

      if (this.config.debugMode) {
        console.log(`🔄 State updated: ${snapshot.sequenceId} (${Date.now() - startTime}ms)`);
      }

    } catch (error) {
      console.error('❌ Error updating game state:', error);
      this.metrics.errorRate++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get the current game state
   */
  getCurrentState(): GameStateSnapshot | null {
    return this.currentState;
  }

  /**
   * Get historical game states
   */
  getStateHistory(count: number = 10): GameStateSnapshot[] {
    const maxCount = Math.min(count, this.stateHistory.length);
    return this.stateHistory.slice(-maxCount);
  }

  /**
   * Detect patterns in game state history
   */
  detectPatterns(): Pattern[] {
    if (!this.config.patternDetectionEnabled) {
      return [];
    }

    return Array.from(this.detectedPatterns.values());
  }

  /**
   * Persist current state and history
   */
  async persistState(): Promise<void> {
    this.ensureInitialized();
      if (!this.memoryService) {
        if (this.config.debugMode) {
        console.warn('⚠️ Memory service not available, skipping persistence.');
        }
        return;
      }

    try {
      await this.updateSessionMemory();
      if (this.config.debugMode) {
        console.log('💾 Game state and session data persisted successfully.');
      }
      this.emit('persisted');
    } catch (error) {
      console.error('❌ Error persisting state:', error);
      this.emit('error', error);
    }
  }

  async updateSessionMemory(): Promise<void> {
    if (!this.memoryService) {
      return;
    }
    const sessionData = this.createSessionData();
    const { sessionId } = this.getCurrentSessionInfo();

    const existingSession = await this.memoryService.getSessionData(sessionId);

    if (existingSession) {
      await this.memoryService.update(sessionId, sessionData);
    } else {
      await this.memoryService.store(sessionData);
    }
  }

  /**
   * Load persisted state and history
   */
  async loadState(): Promise<void> {
    try {
      if (!this.memoryService) {
        if (this.config.debugMode) {
          console.log('📁 No memory service available for loading');
        }
        return;
      }

      // Try to load current session data
      const sessionData = await this.memoryService.getCurrentSessionData('current_player'); // This would need actual player ID
      
      if (sessionData) {
        this.restoreFromSessionData(sessionData);
        
        if (this.config.debugMode) {
          console.log('📁 State loaded successfully');
        }
      }

      this.emit('state-loaded');
    } catch (error) {
      console.error('❌ Error loading state:', error);
      this.emit('error', error);
    }
  }

  // ===== Advanced Analysis Methods =====

  /**
   * Perform comprehensive pattern detection
   */
  private async performPatternDetection(): Promise<void> {
    if (this.stateHistory.length < 10) {
      return; // Need sufficient history for pattern detection
    }

    try {
      const analysisResult = this.analyzePatterns();
      
      // Update detected patterns
      analysisResult.patterns.forEach(pattern => {
        this.detectedPatterns.set(pattern.type + '_' + Date.now(), pattern);
      });

      // Emit pattern detection events
      if (analysisResult.patterns.length > 0) {
        this.emit('patterns-detected', analysisResult);
      }

      // Alert if critical patterns detected
      if (analysisResult.alertLevel === 'critical') {
        this.emit('critical-pattern-detected', analysisResult);
      }

      this.metrics.patternDetectionRate = analysisResult.confidence;
    } catch (error) {
      console.error('❌ Error in pattern detection:', error);
    }
  }

  /**
   * Analyze patterns in state history
   */
  private analyzePatterns(): PatternAnalysisResult {
    const patterns: Pattern[] = [];
    const recentStates = this.getStateHistory(50);
    
    // Behavioral patterns
    patterns.push(...this.detectBehavioralPatterns(recentStates));
    
    // Tactical patterns
    patterns.push(...this.detectTacticalPatterns(recentStates));
    
    // Economic patterns
    patterns.push(...this.detectEconomicPatterns(recentStates));
    
    // Positional patterns
    patterns.push(...this.detectPositionalPatterns(recentStates));

    // Calculate overall confidence
    const confidence = patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0;

    // Generate insights and recommendations
    const insights = this.generateInsights(patterns, recentStates);
    const recommendations = this.generateRecommendations(patterns);
    
    // Determine alert level
    const alertLevel = this.determineAlertLevel(patterns);

    return {
      patterns,
      confidence,
      recommendations,
      insights,
      alertLevel
    };
  }

  /**
   * Detect behavioral patterns in player actions
   */
  private detectBehavioralPatterns(states: GameStateSnapshot[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Analyze aggression levels over time
    const aggressionLevels = states.map(s => 
      s.processed.playerState.observedBehaviors.filter(b => 
        b.includes('aggressive') || b.includes('rush')).length
    );

    if (this.isIncreasingTrend(aggressionLevels)) {
      patterns.push({
        type: 'behavioral',
        description: 'Increasing aggressive behavior detected',
        frequency: aggressionLevels.length,
        confidence: 0.7,
        implications: ['May lead to overextension', 'Could indicate tilt or frustration']
      });
    }

    // Analyze economic efficiency
    const economyEfficiency = states.map(s => 
      s.processed.playerState.money / Math.max(1, s.processed.mapState.round)
    );

    if (this.isDecreasingTrend(economyEfficiency)) {
      patterns.push({
        type: 'behavioral',
        description: 'Declining economic efficiency',
        frequency: economyEfficiency.length,
        confidence: 0.6,
        implications: ['Poor buy decisions', 'Need economy coaching']
      });
    }

    return patterns;
  }

  /**
   * Detect tactical patterns in game play
   */
  private detectTacticalPatterns(states: GameStateSnapshot[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Analyze positioning consistency
    const positions = states.map(s => s.processed.playerState.position);
    const positionVariance = this.calculatePositionVariance(positions);

    if (positionVariance < 50) { // Low variance indicates static play
      patterns.push({
        type: 'tactical',
        description: 'Static positioning pattern detected',
        frequency: positions.length,
        confidence: 0.8,
        implications: ['Predictable play style', 'Vulnerable to counter-strategies']
      });
    }

    return patterns;
  }

  /**
   * Detect economic patterns
   */
  private detectEconomicPatterns(states: GameStateSnapshot[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Analyze buy patterns
    const buyRounds = states.filter(s => s.processed.playerState.money > 3000).length;
    const ecoRounds = states.filter(s => s.processed.playerState.money < 1500).length;

    if (ecoRounds > buyRounds * 1.5) {
      patterns.push({
        type: 'economic',
        description: 'Frequent economy rounds pattern',
        frequency: ecoRounds,
        confidence: 0.7,
        implications: ['Poor economic management', 'Team coordination issues']
      });
    }

    return patterns;
  }

  /**
   * Detect positional patterns
   */
  private detectPositionalPatterns(states: GameStateSnapshot[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Analyze map coverage
    const positions = states.map(s => s.processed.playerState.position);
    const uniqueAreas = new Set(positions.map(p => `${Math.floor(p.x/100)}_${Math.floor(p.y/100)}`));

    if (uniqueAreas.size < 5) { // Limited map coverage
      patterns.push({
        type: 'positional',
        description: 'Limited map coverage pattern',
        frequency: positions.length,
        confidence: 0.6,
        implications: ['Not exploring map fully', 'Missing opportunities']
      });
    }

    return patterns;
  }

  // ===== Helper Methods =====

  /**
   * Create state change record
   */
  private createStateChange(from: GameStateSnapshot | null, to: GameStateSnapshot): StateChange {
    const changeType = this.determineChangeType(from, to);
    const significance = this.calculateSignificance(from, to);
    const affectedAreas = this.identifyAffectedAreas(from, to);
    const metrics = this.calculateChangeMetrics(from, to);

    return {
      id: uuidv4(),
      timestamp: new Date(),
      from,
      to,
      changeType,
      significance,
      affectedAreas,
      metrics
    };
  }

  /**
   * Add state to history with size management
   */
  private addToHistory(snapshot: GameStateSnapshot): void {
    this.stateHistory.push(snapshot);

    // Manage history size
    if (this.stateHistory.length > this.config.maxHistorySize) {
      // Compress and archive oldest states
      const toCompress = this.stateHistory.splice(0, this.stateHistory.length - this.config.maxHistorySize);
      
      if (this.config.compressionEnabled) {
        toCompress.forEach(state => {
          const compressed = this.compressState(state);
          this.compressedHistory.push(compressed);
        });
      }
    }
  }

  /**
   * Compress state for storage efficiency
   */
  private compressState(state: GameStateSnapshot): CompressedState {
    const originalSize = JSON.stringify(state).length;
    
    const compressed: CompressedState = {
      id: state.sequenceId,
      timestamp: state.timestamp,
      essentialData: {
        context: state.processed.context,
        playerHealth: state.processed.playerState.health,
        playerMoney: state.processed.playerState.money,
        teamScore: state.processed.teamState.score,
        round: state.processed.mapState.round,
        situationalFactors: state.processed.situationalFactors
      },
      compressionRatio: 0,
      originalSize
    };

    const compressedSize = JSON.stringify(compressed).length;
    compressed.compressionRatio = 1 - (compressedSize / originalSize);

    return compressed;
  }

  /**
   * Create session data for memory storage
   */
  private createSessionData(): Omit<SessionDataMemory, 'id' | 'createdAt' | 'updatedAt'> {
    const currentSession = this.getCurrentSessionInfo();
    
    return {
      type: MemoryType.SESSION_DATA,
      importance: MemoryImportance.HIGH,
      tags: ['current_session', 'ai_orchestrator'],
      metadata: {
        stateManager: true,
        version: '1.0',
        metricsIncluded: true
      },
      data: {
        sessionId: currentSession.sessionId,
        playerId: currentSession.playerId,
        startTime: currentSession.startTime,
        currentMap: this.currentState?.processed.mapState.name || 'unknown',
        currentGameMode: 'competitive', // Would be detected from GSI
        currentTeamComposition: [], // Would be extracted from team data
        observedBehaviors: this.extractObservedBehaviors(),
        recentTopics: this.extractRecentTopics(),
        coachingNotes: this.generateCoachingNotes(),
        pendingActions: this.identifyPendingActions()
      }
    };
  }

  /**
   * Restore state from session data
   */
  private restoreFromSessionData(sessionData: SessionDataMemory): void {
    // This is a simplified restoration process. A full implementation
    // would involve more complex logic to re-hydrate the state.
    if (this.config.debugMode) {
      console.log('🔄 Restoring state from session data:', sessionData.data.sessionId);
    }
  }

  /**
   * Start background processes
   */
  private startBackgroundProcesses(): void {
    // Periodic persistence
    if (this.config.persistenceInterval > 0) {
      this.persistenceTimer = setInterval(async () => {
        await this.persistState();
      }, this.config.persistenceInterval);
    }

    // Periodic cleanup
    if (this.config.autoCleanupEnabled) {
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, 300000); // Every 5 minutes
    }
  }

  /**
   * Perform cleanup of old data
   */
  private performCleanup(): void {
    const now = Date.now();
    const threshold = this.config.cleanupThreshold;

    // Clean old state changes
    this.stateChanges = this.stateChanges.filter(
      change => now - change.timestamp.getTime() < threshold
    );

    // Clean old compressed history
    this.compressedHistory = this.compressedHistory.filter(
      compressed => now - compressed.timestamp.getTime() < threshold
    );

    // Clean old patterns
    const oldPatterns = Array.from(this.detectedPatterns.entries()).filter(
      ([key]) => {
        const timestamp = parseInt(key.split('_').pop() || '0');
        return now - timestamp > threshold;
      }
    );

    oldPatterns.forEach(([key]) => {
      this.detectedPatterns.delete(key);
    });

    if (this.config.debugMode) {
      console.log(`🧹 Cleanup completed: removed ${oldPatterns.length} old patterns`);
    }
  }

  // ===== Utility Methods =====

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StateManager is not initialized. Call initialize() first.');
    }
  }

  private validateState(snapshot: GameStateSnapshot): boolean {
    return !!(snapshot.raw && snapshot.processed && snapshot.timestamp && snapshot.sequenceId);
  }

  private limitStateChanges(): void {
    const maxChanges = 500;
    if (this.stateChanges.length > maxChanges) {
      this.stateChanges = this.stateChanges.slice(-maxChanges);
    }
  }

  private updateMetrics(processingTime: number): void {
    this.metrics.totalStates++;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalStates - 1) + processingTime) / 
      this.metrics.totalStates;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    this.metrics.lastUpdate = new Date();
  }

  // Methods for complex state analysis
  private determineChangeType(from: GameStateSnapshot | null, to: GameStateSnapshot): StateChange['changeType'] {
    if (!from) return 'normal_update';
    if (from.processed.mapState.round !== to.processed.mapState.round) return 'round_start';
    if (from.processed.phase !== to.processed.phase) return 'phase_change';
    return 'normal_update';
  }

  private calculateSignificance(from: GameStateSnapshot | null, to: GameStateSnapshot): StateChange['significance'] {
    if (!from) return 'low';
    
    const healthDelta = Math.abs(to.processed.playerState.health - from.processed.playerState.health);
    const roundDelta = to.processed.mapState.round - from.processed.mapState.round;
    
    if (roundDelta > 0 || healthDelta > 50) return 'high';
    if (healthDelta > 20) return 'medium';
    return 'low';
  }

  private identifyAffectedAreas(from: GameStateSnapshot | null, to: GameStateSnapshot): string[] {
    const areas: string[] = [];
    
    if (!from) return ['initialization'];
    
    if (from.processed.playerState.health !== to.processed.playerState.health) areas.push('player_health');
    if (from.processed.playerState.money !== to.processed.playerState.money) areas.push('economy');
    if (from.processed.mapState.round !== to.processed.mapState.round) areas.push('round');
    
    return areas;
  }

  private calculateChangeMetrics(from: GameStateSnapshot | null, to: GameStateSnapshot): StateChange['metrics'] {
    if (!from) {
      return { healthChange: 0, economyChange: 0, positionChange: 0, performanceChange: 0 };
    }

    return {
      healthChange: to.processed.playerState.health - from.processed.playerState.health,
      economyChange: to.processed.playerState.money - from.processed.playerState.money,
      positionChange: this.calculatePositionDistance(from.processed.playerState.position, to.processed.playerState.position),
      performanceChange: to.processed.playerState.statistics.rating - from.processed.playerState.statistics.rating
    };
  }

  private calculatePositionDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2) + Math.pow(pos2.z - pos1.z, 2));
  }

  private isIncreasingTrend(values: number[]): boolean {
    if (values.length < 3) return false;
    const recent = values.slice(-5);
    const slope = this.calculateSlope(recent);
    return slope > 0.1;
  }

  private isDecreasingTrend(values: number[]): boolean {
    if (values.length < 3) return false;
    const recent = values.slice(-5);
    const slope = this.calculateSlope(recent);
    return slope < -0.1;
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = values.reduce((sum, _, x) => sum + x * x, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculatePositionVariance(positions: { x: number; y: number; z: number }[]): number {
    if (positions.length < 2) return 0;
    
    const meanX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const meanY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
    
    const variance = positions.reduce((sum, p) => {
      return sum + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2);
    }, 0) / positions.length;
    
    return Math.sqrt(variance);
  }

  private generateInsights(patterns: Pattern[], states: GameStateSnapshot[]): PatternAnalysisResult['insights'] {
    return {
      playerBehavior: patterns.filter(p => p.type === 'behavioral').map(p => p.description),
      teamDynamics: [], // Would analyze team patterns
      economicTrends: patterns.filter(p => p.type === 'economic').map(p => p.description),
      tacticalPatterns: patterns.filter(p => p.type === 'tactical').map(p => p.description)
    };
  }

  private generateRecommendations(patterns: Pattern[]): string[] {
    const recommendations: string[] = [];
    
    patterns.forEach(pattern => {
      recommendations.push(...pattern.implications.map(impl => 
        `Consider addressing: ${impl} (based on ${pattern.description})`
      ));
    });
    
    return recommendations;
  }

  private determineAlertLevel(patterns: Pattern[]): PatternAnalysisResult['alertLevel'] {
    const highConfidencePatterns = patterns.filter(p => p.confidence > 0.8);
    const criticalImplications = patterns.some(p => 
      p.implications.some(impl => impl.includes('critical') || impl.includes('danger'))
    );
    
    if (criticalImplications) return 'critical';
    if (highConfidencePatterns.length > 2) return 'warning';
    if (patterns.length > 0) return 'attention';
    return 'normal';
  }

  private getCurrentSessionInfo(): { sessionId: string; playerId: string; startTime: Date } {
    // In a real application, this would be managed more robustly.
    // For now, we'll use a static session for demonstration.
    const playerId = this.currentState?.processed.playerState.steamId || 'unknown_player';
    return {
      sessionId: `session_${playerId}`,
      playerId,
      startTime: this.stateHistory[0]?.timestamp || new Date()
    };
  }

  private extractObservedBehaviors(): SessionDataMemory['data']['observedBehaviors'] {
    if (this.stateHistory.length < 3) return [];

    const behaviors: SessionDataMemory['data']['observedBehaviors'] = [];
    const recentStates = this.stateHistory.slice(-20); // Analyze last 20 states

    // Analyze aggression patterns from observed behaviors
    const aggressiveBehaviors = recentStates
      .map(state => state.processed.playerState.observedBehaviors.filter(b => 
        b.includes('aggressive') || b.includes('rush') || b.includes('push')
      ).length / Math.max(state.processed.playerState.observedBehaviors.length, 1))
      .filter(score => !isNaN(score));
    
    if (aggressiveBehaviors.length > 0) {
      const avgAggression = aggressiveBehaviors.reduce((sum, score) => sum + score, 0) / aggressiveBehaviors.length;
      if (avgAggression > 0.7) {
        behaviors.push({
          timestamp: new Date(),
          behavior: 'aggressive_playstyle',
          context: 'Player shows consistently aggressive behavior patterns',
          significance: 0.8
        });
      } else if (avgAggression < 0.3) {
        behaviors.push({
          timestamp: new Date(),
          behavior: 'passive_playstyle',
          context: 'Player shows consistently passive behavior patterns',
          significance: 0.8
        });
      }
    }

    // Analyze positioning patterns from observed behaviors
    const positioningBehaviors = recentStates
      .map(state => state.processed.playerState.observedBehaviors.filter(b => 
        b.includes('position') || b.includes('exposed') || b.includes('isolated')
      ).length / Math.max(state.processed.playerState.observedBehaviors.length, 1))
      .filter(score => !isNaN(score));
    
    if (positioningBehaviors.length > 0) {
      const avgPositioning = positioningBehaviors.reduce((sum, score) => sum + score, 0) / positioningBehaviors.length;
      if (avgPositioning > 0.4) {
        behaviors.push({
          timestamp: new Date(),
          behavior: 'poor_positioning',
          context: 'Player frequently takes suboptimal positions',
          significance: 0.7
        });
      }
    }

    // Analyze economic patterns from money management
    const economyEfficiency = recentStates
      .map(state => {
        const money = state.processed.playerState.money;
        const maxMoney = 16000;
        return money / maxMoney;
      })
      .filter(score => !isNaN(score));
    
    if (economyEfficiency.length > 0) {
      const avgEconomy = economyEfficiency.reduce((sum, score) => sum + score, 0) / economyEfficiency.length;
      if (avgEconomy < 0.4) {
        behaviors.push({
          timestamp: new Date(),
          behavior: 'poor_economy_management',
          context: 'Player shows poor economic decision making',
          significance: 0.6
        });
      }
    }

    return behaviors;
  }

  private extractRecentTopics(): SessionDataMemory['data']['recentTopics'] {
    const topics: SessionDataMemory['data']['recentTopics'] = [];
    const recentStates = this.stateHistory.slice(-10); // Analyze last 10 states
    const recentPatterns = Array.from(this.detectedPatterns.values()).slice(-5);

    // Extract topics from detected patterns
    recentPatterns.forEach(pattern => {
      const topic = {
        topic: pattern.type,
        lastDiscussed: pattern.lastOccurrence || new Date(),
        importance: this.mapPatternToImportance(pattern.confidence),
        context: pattern.description,
        actionItems: pattern.implications
      };
      topics.push(topic);
    });

    // Extract topics from situational factors
    recentStates.forEach(state => {
      const criticalFactors = state.processed.situationalFactors
        .filter(factor => factor.severity === 'high' || factor.severity === 'critical');
      
      criticalFactors.forEach(factor => {
        const existingTopic = topics.find(t => t.topic === factor.type);
        if (!existingTopic) {
          topics.push({
            topic: factor.type,
            lastDiscussed: state.timestamp,
            importance: factor.severity === 'critical' ? 'high' : 'medium',
            context: factor.description,
            actionItems: factor.context
          });
        }
      });
    });

    // Extract topics from behavioral analysis
    const latestState = recentStates[recentStates.length - 1];
    if (latestState?.processed.playerState.observedBehaviors) {
      const behaviors = latestState.processed.playerState.observedBehaviors;
      
      // Check for concerning behavior patterns
      const hasAggressiveBehavior = behaviors.some(b => b.includes('aggressive') || b.includes('rush'));
      if (hasAggressiveBehavior) {
        topics.push({
          topic: 'excessive_aggression',
          lastDiscussed: latestState.timestamp,
          importance: 'medium',
          context: 'Player showing very aggressive behavior that may lead to unnecessary risks',
          actionItems: ['Consider more cautious positioning', 'Focus on team coordination']
        });
      }
      
      const hasPoorPositioning = behaviors.some(b => b.includes('poor_position') || b.includes('exposed'));
      if (hasPoorPositioning) {
        topics.push({
          topic: 'positioning_improvement',
          lastDiscussed: latestState.timestamp,
          importance: 'high',
          context: 'Player consistently taking poor positions',
          actionItems: ['Review map positioning', 'Practice crosshair placement', 'Study professional demos']
        });
      }
      
      const hasPoorEconomy = behaviors.some(b => b.includes('poor_buy') || b.includes('economy_mistake'));
      if (hasPoorEconomy) {
        topics.push({
          topic: 'economy_management',
          lastDiscussed: latestState.timestamp,
          importance: 'medium',
          context: 'Player making poor economic decisions',
          actionItems: ['Review buy strategies', 'Learn force-buy situations', 'Practice eco rounds']
        });
      }
    }

    // Sort by importance and recency, limit to most relevant topics
    return topics
      .sort((a, b) => {
        const importanceOrder = { high: 3, medium: 2, low: 1 };
        const importanceDiff = importanceOrder[b.importance] - importanceOrder[a.importance];
        if (importanceDiff !== 0) return importanceDiff;
        return b.lastDiscussed.getTime() - a.lastDiscussed.getTime();
      })
      .slice(0, 10); // Keep only top 10 most relevant topics
  }

  private mapPatternToImportance(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  private generateCoachingNotes(): string[] {
    const notes: string[] = [];
    if (!this.currentState) {
    return notes;
  }
    notes.push(`Current round: ${this.currentState.processed.mapState.round}`);
    notes.push(`Player health: ${this.currentState.processed.playerState.health}`);
    
    const criticalFactors = this.currentState.processed.situationalFactors
      .filter(f => f.severity === 'critical')
      .map(f => f.description);
      
    if (criticalFactors.length > 0) {
      notes.push(`Critical factors: ${criticalFactors.join(', ')}`);
      }

    return notes;
  }

  private identifyPendingActions(): SessionDataMemory['data']['pendingActions'] {
    const actions: SessionDataMemory['data']['pendingActions'] = [];
    const currentState = this.currentState;
    
    if (!currentState) return actions;

    const playerState = currentState.processed.playerState;
    const mapState = currentState.processed.mapState;
    const situationalFactors = currentState.processed.situationalFactors;

    // Check for immediate tactical actions needed
    const criticalFactors = situationalFactors.filter(f => f.severity === 'critical');
    criticalFactors.forEach(factor => {
      actions.push({
        action: `address_${factor.type}`,
        priority: 3, // high priority
        deadline: new Date(Date.now() + 30000) // 30 seconds for critical issues
      });
    });

    // Check for behavioral improvements needed
    if (playerState.observedBehaviors) {
      const behaviors = playerState.observedBehaviors;
      
      const hasPoorPositioning = behaviors.some(b => b.includes('poor_position') || b.includes('exposed'));
      if (hasPoorPositioning) {
        actions.push({
          action: 'improve_positioning',
          priority: 2, // medium priority
          deadline: new Date(Date.now() + 300000) // 5 minutes
        });
      }
      
      const hasPoorEconomy = behaviors.some(b => b.includes('poor_buy') || b.includes('economy_mistake'));
      if (hasPoorEconomy) {
        actions.push({
          action: 'review_economy',
          priority: 2, // medium priority
          deadline: new Date(Date.now() + 180000) // 3 minutes
        });
      }
      
      const hasPoorTeamplay = behaviors.some(b => b.includes('isolated') || b.includes('poor_communication'));
      if (hasPoorTeamplay) {
        actions.push({
          action: 'improve_teamwork',
          priority: 2, // medium priority
          deadline: new Date(Date.now() + 240000) // 4 minutes
        });
      }
    }

    // Check for round-specific actions
    if (mapState.phase === 'freezetime') {
      actions.push({
        action: 'plan_round_strategy',
        priority: 3, // high priority
        deadline: new Date(Date.now() + 15000) // 15 seconds (freezetime duration)
      });
    }

    // Check for equipment/economy actions
    if (playerState.money > 5000 && mapState.phase === 'freezetime') {
      actions.push({
        action: 'optimize_equipment',
        priority: 2, // medium priority
        deadline: new Date(Date.now() + 10000) // 10 seconds
      });
    }

    // Check for learning opportunities
    const recentStates = this.stateHistory.slice(-5);
    const hasRepeatedMistakes = this.detectRepeatedMistakes(recentStates);
    if (hasRepeatedMistakes.length > 0) {
      hasRepeatedMistakes.forEach(mistake => {
        actions.push({
          action: 'address_repeated_mistake',
          priority: 2, // medium priority
          deadline: new Date(Date.now() + 600000) // 10 minutes
        });
      });
    }

    // Sort by priority and deadline
    return actions.sort((a, b) => {
      // Priority is now numeric (3=high, 2=medium, 1=low)
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      // Handle optional deadline field
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    });
  }

  private detectRepeatedMistakes(states: GameStateSnapshot[]): string[] {
    const mistakes: string[] = [];
    
    // Check for repeated positioning mistakes
    const poorPositioningCount = states.filter(state => {
      const behaviors = state.processed.playerState.observedBehaviors || [];
      return behaviors.some(b => b.includes('poor_position') || b.includes('exposed'));
    }).length;
    
    if (poorPositioningCount >= 3) {
      mistakes.push('poor_positioning');
    }
    
    // Check for repeated economic mistakes
    const poorEconomyCount = states.filter(state => {
      const behaviors = state.processed.playerState.observedBehaviors || [];
      return behaviors.some(b => b.includes('poor_buy') || b.includes('economy_mistake'));
    }).length;
    
    if (poorEconomyCount >= 3) {
      mistakes.push('poor_economy_management');
    }
    
    return mistakes;
  }

  /**
   * Get state management metrics
   */
  getMetrics(): StateMetrics {
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    return this.metrics;
  }
}

// ===== Factory Function =====

/**
 * Create and initialize a dynamic state manager
 */
export async function createStateManager(
  config?: Partial<StateManagerConfig>,
  memoryService?: MemoryService
): Promise<DynamicStateManager> {
  const manager = new DynamicStateManager(config, memoryService);
  await manager.initialize();
  return manager;
}

// ===== Export Default Instance =====

/**
 * Default state manager instance
 */
let defaultManager: DynamicStateManager | null = null;

/**
 * Get the default state manager instance
 */
export async function getDefaultStateManager(memoryService?: MemoryService): Promise<DynamicStateManager> {
  if (!defaultManager) {
    defaultManager = await createStateManager({}, memoryService);
  }
  return defaultManager;
}