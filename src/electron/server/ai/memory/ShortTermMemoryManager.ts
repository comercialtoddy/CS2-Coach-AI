/**
 * Short-Term Memory Manager Implementation
 * 
 * This service coordinates all in-memory cache operations for the MemoryService,
 * providing efficient access to frequently used data and managing memory constraints.
 * Implements the concrete logic for managing player caches, session data, and contextual knowledge.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EnhancedLRUCache,
  CacheEntry,
  CacheStats,
  PlayerCache,
  SessionCache,
  ContextualCache,
  ShortTermMemoryManager,
  DEFAULT_CACHE_CONFIG,
  calculateEntrySize,
  computePriorityScore
} from './ShortTermMemorySchemas.js';
import {
  BaseMemoryEntry,
  MemoryType,
  MemoryImportance,
  PlayerProfileMemory,
  InteractionHistoryMemory,
  GameKnowledgeMemory,
  SessionDataMemory,
  CoachingInsightsMemory,
  MemoryQueryOptions,
  MemoryRetrievalResult
} from '../interfaces/MemoryService.js';

/**
 * Configuration for the short-term memory manager
 */
export interface ShortTermMemoryConfig {
  globalMaxMemoryMB: number;
  cleanupIntervalMs: number;
  enablePreloading: boolean;
  enableContextualCaching: boolean;
  enableStatistics: boolean;
  debugMode: boolean;
}

/**
 * Default configuration for short-term memory
 */
const DEFAULT_CONFIG: ShortTermMemoryConfig = {
  globalMaxMemoryMB: 100,        // 100MB total memory limit
  cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
  enablePreloading: true,
  enableContextualCaching: true,
  enableStatistics: true,
  debugMode: false
};

/**
 * Short-Term Memory Manager Implementation
 * 
 * Manages all in-memory caching operations and coordinates between different cache types.
 * Provides efficient access patterns and memory management for AI coaching data.
 */
export class ShortTermMemoryManagerImpl implements ShortTermMemoryManager {
  // Type-specific caches
  public readonly playerProfiles: EnhancedLRUCache<PlayerProfileMemory>;
  public readonly interactionHistory: EnhancedLRUCache<InteractionHistoryMemory>;
  public readonly gameKnowledge: EnhancedLRUCache<GameKnowledgeMemory>;
  public readonly sessionData: EnhancedLRUCache<SessionDataMemory>;
  public readonly coachingInsights: EnhancedLRUCache<CoachingInsightsMemory>;

  // Specialized indexes
  public readonly playerIndex: Map<string, PlayerCache>;
  public readonly sessionIndex: Map<string, SessionCache>;
  public readonly contextIndex: Map<string, ContextualCache>;

  // Global metrics and configuration
  public readonly globalStats: ShortTermMemoryManager['globalStats'];
  public readonly config: ShortTermMemoryManager['config'];

  // Private fields for internal management
  private cleanupTimer?: NodeJS.Timeout;
  private initialized: boolean = false;
  private statistics: Map<string, number> = new Map();

  constructor(config: Partial<ShortTermMemoryConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Initialize type-specific caches with their configurations
    const playerConfig = DEFAULT_CACHE_CONFIG[MemoryType.PLAYER_PROFILE];
    this.playerProfiles = new EnhancedLRUCache<PlayerProfileMemory>(
      playerConfig.maxEntries, 
      playerConfig.maxMemoryMB
    );

    const interactionConfig = DEFAULT_CACHE_CONFIG[MemoryType.INTERACTION_HISTORY];
    this.interactionHistory = new EnhancedLRUCache<InteractionHistoryMemory>(
      interactionConfig.maxEntries, 
      interactionConfig.maxMemoryMB
    );

    const knowledgeConfig = DEFAULT_CACHE_CONFIG[MemoryType.GAME_KNOWLEDGE];
    this.gameKnowledge = new EnhancedLRUCache<GameKnowledgeMemory>(
      knowledgeConfig.maxEntries, 
      knowledgeConfig.maxMemoryMB
    );

    const sessionConfig = DEFAULT_CACHE_CONFIG[MemoryType.SESSION_DATA];
    this.sessionData = new EnhancedLRUCache<SessionDataMemory>(
      sessionConfig.maxEntries, 
      sessionConfig.maxMemoryMB
    );

    const insightsConfig = DEFAULT_CACHE_CONFIG[MemoryType.COACHING_INSIGHTS];
    this.coachingInsights = new EnhancedLRUCache<CoachingInsightsMemory>(
      insightsConfig.maxEntries, 
      insightsConfig.maxMemoryMB
    );

    // Initialize specialized indexes
    this.playerIndex = new Map<string, PlayerCache>();
    this.sessionIndex = new Map<string, SessionCache>();
    this.contextIndex = new Map<string, ContextualCache>();

    // Initialize global metrics
    this.globalStats = {
      totalMemoryUsage: 0,
      totalEntries: 0,
      globalHitRate: 0,
      lastCleanup: Date.now(),
      startTime: Date.now()
    };

    // Store configuration
    this.config = {
      globalMaxMemoryMB: finalConfig.globalMaxMemoryMB,
      cleanupIntervalMs: finalConfig.cleanupIntervalMs,
      enablePreloading: finalConfig.enablePreloading,
      enableContextualCaching: finalConfig.enableContextualCaching
    };

    if (finalConfig.debugMode) {
      console.log('🧠 ShortTermMemoryManager initialized with config:', this.config);
    }
  }

  // ===== Initialization and Lifecycle =====

  /**
   * Initialize the memory manager and start background processes
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️ ShortTermMemoryManager already initialized');
      return;
    }

    console.log('🚀 Initializing ShortTermMemoryManager...');

    // Start periodic cleanup
    this.startCleanupTimer();

    // Initialize statistics tracking
    this.initializeStatistics();

    // Mark as initialized
    this.initialized = true;
    
    console.log('✅ ShortTermMemoryManager initialized successfully');
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Dispose of the memory manager and clean up resources
   */
  async dispose(): Promise<void> {
    console.log('🛑 Disposing ShortTermMemoryManager...');

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear all caches
    this.clearAllCaches();

    // Reset state
    this.initialized = false;
    this.statistics.clear();

    console.log('✅ ShortTermMemoryManager disposed successfully');
  }

  // ===== Core Memory Operations =====

  /**
   * Store a memory entry in the appropriate cache
   */
  async store<T extends BaseMemoryEntry>(
    entry: T,
    options: { forceEviction?: boolean; updateIndexes?: boolean } = {}
  ): Promise<boolean> {
    const { forceEviction = false, updateIndexes = true } = options;

    try {
      // Create cache entry with metadata
      const cacheEntry: CacheEntry<T> = {
        data: entry,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        expiryTime: entry.expiresAt ? new Date(entry.expiresAt).getTime() : Date.now() + this.getDefaultTTL(entry.type),
        size: calculateEntrySize(entry),
        priority: computePriorityScore({ data: entry } as CacheEntry),
        source: 'shortterm',
        metadata: {
          dirty: false,
          sessionId: this.extractSessionId(entry),
          playerId: this.extractPlayerId(entry)
        }
      };

      // Store in appropriate cache
      const success = await this.storeInCache(entry.type, entry.id, cacheEntry, forceEviction);

      if (success && updateIndexes) {
        // Update specialized indexes
        await this.updateIndexes(entry, 'store');
        
        // Update global statistics
        this.updateGlobalStats();
      }

      return success;
    } catch (error) {
      console.error('❌ Error storing memory entry:', error);
      return false;
    }
  }

  /**
   * Retrieve a memory entry from cache
   */
  async get<T extends BaseMemoryEntry>(entryId: string, type?: MemoryType): Promise<T | null> {
    try {
      let cacheEntry: CacheEntry<T> | null = null;

      if (type) {
        // Search in specific cache
        cacheEntry = this.getFromCache<T>(type, entryId);
      } else {
        // Search across all caches
        cacheEntry = this.searchAllCaches<T>(entryId);
      }

      if (cacheEntry) {
        // Update access statistics
        this.updateAccessStats(entryId, true);
        return cacheEntry.data;
      }

      // Cache miss
      this.updateAccessStats(entryId, false);
      return null;
    } catch (error) {
      console.error('❌ Error retrieving memory entry:', error);
      return null;
    }
  }

  /**
   * Update a memory entry in cache
   */
  async update<T extends BaseMemoryEntry>(
    entryId: string,
    updates: Partial<T>,
    type?: MemoryType
  ): Promise<boolean> {
    try {
      const existing = await this.get<T>(entryId, type);
      if (!existing) {
        return false;
      }

      // Merge updates
      const updated: T = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Store updated entry
      return await this.store(updated, { updateIndexes: true });
    } catch (error) {
      console.error('❌ Error updating memory entry:', error);
      return false;
    }
  }

  /**
   * Remove a memory entry from cache
   */
  async remove(entryId: string, type?: MemoryType): Promise<boolean> {
    try {
      let removed = false;

      if (type) {
        // Remove from specific cache
        removed = this.removeFromCache(type, entryId);
      } else {
        // Remove from all caches
        removed = this.removeFromAllCaches(entryId);
      }

      if (removed) {
        // Update indexes
        await this.updateIndexes({ id: entryId } as BaseMemoryEntry, 'remove');
        
        // Update global statistics
        this.updateGlobalStats();
      }

      return removed;
    } catch (error) {
      console.error('❌ Error removing memory entry:', error);
      return false;
    }
  }

  // ===== Specialized Access Methods =====

  /**
   * Get player-specific cache data
   */
  async getPlayerCache(steamId: string): Promise<PlayerCache | null> {
    return this.playerIndex.get(steamId) || null;
  }

  /**
   * Get session-specific cache data
   */
  async getSessionCache(sessionId: string): Promise<SessionCache | null> {
    return this.sessionIndex.get(sessionId) || null;
  }

  /**
   * Get contextual cache for specific game situations
   */
  async getContextualCache(context: string): Promise<ContextualCache | null> {
    return this.contextIndex.get(context) || null;
  }

  /**
   * Query memories with filters and options
   */
  async query<T extends BaseMemoryEntry>(
    filters: {
      type?: MemoryType;
      steamId?: string;
      sessionId?: string;
      tags?: string[];
      importance?: MemoryImportance[];
    },
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<T>> {
    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      includeExpired = false
    } = options;

    try {
      let entries: Array<{ key: string; value: CacheEntry<T> }> = [];
      const now = Date.now();

      // Collect entries from relevant caches
      const caches = filters.type ? [this.getCacheByType(filters.type)] : this.getAllCaches();
      
      for (const cache of caches) {
        if (cache) {
          const cacheEntries = cache.getEntriesWhere((entry: CacheEntry<any>) => {
            // Apply filters
            if (!includeExpired && entry.expiryTime < now) return false;
            if (filters.steamId && this.extractPlayerId(entry.data) !== filters.steamId) return false;
            if (filters.sessionId && this.extractSessionId(entry.data) !== filters.sessionId) return false;
            if (filters.importance && !filters.importance.includes(entry.data.importance)) return false;
            if (filters.tags && !this.hasAnyTag(entry.data.tags, filters.tags)) return false;
            
            return true;
          });
          
          entries.push(...cacheEntries);
        }
      }

      // Sort entries
      entries.sort((a, b) => {
        const aValue = this.getSortValue(a.value, sortBy);
        const bValue = this.getSortValue(b.value, sortBy);
        
        if (sortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });

      // Apply pagination
      const totalCount = entries.length;
      const paginatedEntries = entries.slice(offset, offset + limit);
      
      // Extract data
      const resultEntries: T[] = paginatedEntries.map(({ value }) => value.data);

      return {
        entries: resultEntries,
        totalCount,
        hasMore: offset + limit < totalCount,
        searchTime: Date.now() - startTime,
        fromCache: true
      };
    } catch (error) {
      console.error('❌ Error querying memory entries:', error);
      return {
        entries: [],
        totalCount: 0,
        hasMore: false,
        searchTime: Date.now() - startTime,
        fromCache: false
      };
    }
  }

  // ===== Cache Management =====

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.playerProfiles.clear();
    this.interactionHistory.clear();
    this.gameKnowledge.clear();
    this.sessionData.clear();
    this.coachingInsights.clear();
    
    this.playerIndex.clear();
    this.sessionIndex.clear();
    this.contextIndex.clear();
    
    this.updateGlobalStats();
    
    console.log('🧹 All caches cleared');
  }

  /**
   * Perform cleanup of expired entries
   */
  async cleanup(): Promise<number> {
    console.log('🧹 Starting cache cleanup...');
    
    let totalCleaned = 0;
    
    // Cleanup each cache
    totalCleaned += this.playerProfiles.cleanup();
    totalCleaned += this.interactionHistory.cleanup();
    totalCleaned += this.gameKnowledge.cleanup();
    totalCleaned += this.sessionData.cleanup();
    totalCleaned += this.coachingInsights.cleanup();
    
    // Cleanup indexes
    totalCleaned += this.cleanupIndexes();
    
    // Update global stats
    this.globalStats.lastCleanup = Date.now();
    this.updateGlobalStats();
    
    console.log(`✅ Cache cleanup completed. Removed ${totalCleaned} expired entries`);
    
    return totalCleaned;
  }

  /**
   * Get comprehensive memory statistics
   */
  getMemoryStats(): {
    global: typeof this.globalStats;
    caches: Record<string, CacheStats>;
    indexes: { players: number; sessions: number; contexts: number };
    performance: { uptime: number; memoryEfficiency: number };
  } {
    const cacheStats = {
      playerProfiles: this.playerProfiles.getStats(),
      interactionHistory: this.interactionHistory.getStats(),
      gameKnowledge: this.gameKnowledge.getStats(),
      sessionData: this.sessionData.getStats(),
      coachingInsights: this.coachingInsights.getStats()
    };

    const uptime = Date.now() - this.globalStats.startTime;
    const totalHits = Object.values(cacheStats).reduce((sum, stats) => sum + stats.hitCount, 0);
    const totalMisses = Object.values(cacheStats).reduce((sum, stats) => sum + stats.missCount, 0);
    const memoryEfficiency = totalHits / Math.max(1, totalHits + totalMisses);

    return {
      global: this.globalStats,
      caches: cacheStats,
      indexes: {
        players: this.playerIndex.size,
        sessions: this.sessionIndex.size,
        contexts: this.contextIndex.size
      },
      performance: {
        uptime,
        memoryEfficiency
      }
    };
  }

  // ===== Private Helper Methods =====

  private async storeInCache<T extends BaseMemoryEntry>(
    type: MemoryType,
    key: string,
    entry: CacheEntry<T>,
    forceEviction: boolean
  ): Promise<boolean> {
    const cache = this.getCacheByType(type);
    if (!cache) {
      console.error(`❌ No cache found for type: ${type}`);
      return false;
    }

    // Check memory constraints
    if (!forceEviction && !this.checkMemoryConstraints(entry.size)) {
      console.warn('⚠️ Memory constraints exceeded, attempting cleanup...');
      await this.cleanup();
      
      if (!this.checkMemoryConstraints(entry.size)) {
        console.error('❌ Cannot store entry: memory constraints still exceeded after cleanup');
        return false;
      }
    }

    return cache.put(key, entry);
  }

  private getFromCache<T extends BaseMemoryEntry>(type: MemoryType, key: string): CacheEntry<T> | null {
    const cache = this.getCacheByType(type);
    return cache ? cache.get(key) as CacheEntry<T> : null;
  }

  private removeFromCache(type: MemoryType, key: string): boolean {
    const cache = this.getCacheByType(type);
    return cache ? cache.remove(key) : false;
  }

  private searchAllCaches<T extends BaseMemoryEntry>(entryId: string): CacheEntry<T> | null {
    const caches = this.getAllCaches();
    
    for (const cache of caches) {
      const entry = cache.get(entryId);
      if (entry) {
        return entry as CacheEntry<T>;
      }
    }
    
    return null;
  }

  private removeFromAllCaches(entryId: string): boolean {
    let removed = false;
    const caches = this.getAllCaches();
    
    for (const cache of caches) {
      if (cache.remove(entryId)) {
        removed = true;
      }
    }
    
    return removed;
  }

  private getCacheByType(type: MemoryType): EnhancedLRUCache<any> | null {
    switch (type) {
      case MemoryType.PLAYER_PROFILE:
        return this.playerProfiles;
      case MemoryType.INTERACTION_HISTORY:
        return this.interactionHistory;
      case MemoryType.GAME_KNOWLEDGE:
        return this.gameKnowledge;
      case MemoryType.SESSION_DATA:
        return this.sessionData;
      case MemoryType.COACHING_INSIGHTS:
        return this.coachingInsights;
      default:
        return null;
    }
  }

  private getAllCaches(): EnhancedLRUCache<any>[] {
    return [
      this.playerProfiles,
      this.interactionHistory,
      this.gameKnowledge,
      this.sessionData,
      this.coachingInsights
    ];
  }

  private async updateIndexes(entry: BaseMemoryEntry, operation: 'store' | 'remove'): Promise<void> {
    const steamId = this.extractPlayerId(entry);
    const sessionId = this.extractSessionId(entry);

    if (operation === 'store') {
      // Update player index
      if (steamId) {
        await this.updatePlayerIndex(steamId, entry);
      }

      // Update session index
      if (sessionId) {
        await this.updateSessionIndex(sessionId, entry);
      }

      // Update contextual index if enabled
      if (this.config.enableContextualCaching) {
        await this.updateContextualIndex(entry);
      }
    } else if (operation === 'remove') {
      // Remove from indexes
      if (steamId && this.playerIndex.has(steamId)) {
        await this.cleanupPlayerIndex(steamId, entry.id);
      }

      if (sessionId && this.sessionIndex.has(sessionId)) {
        await this.cleanupSessionIndex(sessionId, entry.id);
      }
    }
  }

  private async updatePlayerIndex(steamId: string, entry: BaseMemoryEntry): Promise<void> {
    let playerCache = this.playerIndex.get(steamId);
    
    if (!playerCache) {
      playerCache = {
        steamId,
        playerName: this.extractPlayerName(entry) || steamId,
        lastActivity: Date.now(),
        recentInteractions: [],
        activeInsights: [],
        accessFrequency: 0,
        totalMemoryUsage: 0,
        cacheEfficiency: 0
      };
      this.playerIndex.set(steamId, playerCache);
    }

    // Update player cache based on entry type
    const cacheEntry = this.getFromCache(entry.type, entry.id);
    if (cacheEntry) {
      switch (entry.type) {
        case MemoryType.PLAYER_PROFILE:
          playerCache.profile = cacheEntry as CacheEntry<PlayerProfileMemory>;
          break;
        case MemoryType.INTERACTION_HISTORY:
          playerCache.recentInteractions.push(cacheEntry as CacheEntry<InteractionHistoryMemory>);
          // Keep only last 10 interactions
          if (playerCache.recentInteractions.length > 10) {
            playerCache.recentInteractions = playerCache.recentInteractions.slice(-10);
          }
          break;
        case MemoryType.SESSION_DATA:
          playerCache.currentSession = cacheEntry as CacheEntry<SessionDataMemory>;
          break;
        case MemoryType.COACHING_INSIGHTS:
          playerCache.activeInsights.push(cacheEntry as CacheEntry<CoachingInsightsMemory>);
          // Keep only last 5 insights
          if (playerCache.activeInsights.length > 5) {
            playerCache.activeInsights = playerCache.activeInsights.slice(-5);
          }
          break;
      }

      // Update metrics
      playerCache.lastActivity = Date.now();
      playerCache.accessFrequency++;
      playerCache.totalMemoryUsage = this.calculatePlayerMemoryUsage(playerCache);
    }
  }

  private async updateSessionIndex(sessionId: string, entry: BaseMemoryEntry): Promise<void> {
    let sessionCache = this.sessionIndex.get(sessionId);
    
    if (!sessionCache) {
      sessionCache = {
        sessionId,
        playerId: this.extractPlayerId(entry) || 'unknown',
        startTime: Date.now(),
        isActive: true,
        sessionData: {} as CacheEntry<SessionDataMemory>,
        contextualKnowledge: [],
        realtimeInsights: [],
        memoryUsage: 0,
        interactionCount: 0,
        lastUpdateTime: Date.now()
      };
      this.sessionIndex.set(sessionId, sessionCache);
    }

    // Update session cache based on entry type
    const cacheEntry = this.getFromCache(entry.type, entry.id);
    if (cacheEntry) {
      switch (entry.type) {
        case MemoryType.SESSION_DATA:
          sessionCache.sessionData = cacheEntry as CacheEntry<SessionDataMemory>;
          break;
        case MemoryType.GAME_KNOWLEDGE:
          sessionCache.contextualKnowledge.push(cacheEntry as CacheEntry<GameKnowledgeMemory>);
          break;
        case MemoryType.COACHING_INSIGHTS:
          sessionCache.realtimeInsights.push(cacheEntry as CacheEntry<CoachingInsightsMemory>);
          break;
      }

      // Update metrics
      sessionCache.lastUpdateTime = Date.now();
      sessionCache.interactionCount++;
      sessionCache.memoryUsage = this.calculateSessionMemoryUsage(sessionCache);
    }
  }

  private async updateContextualIndex(entry: BaseMemoryEntry): Promise<void> {
    // Extract context from entry for contextual caching
    const contexts = this.extractContexts(entry);
    
    for (const context of contexts) {
      let contextCache = this.contextIndex.get(context);
      
      if (!contextCache) {
        contextCache = {
          context,
          relevanceScore: 0.5,
          lastUsed: Date.now(),
          gameKnowledge: [],
          applicableInsights: [],
          timesReferenced: 0,
          averageUtility: 0.5
        };
        this.contextIndex.set(context, contextCache);
      }

      // Update context cache
      const cacheEntry = this.getFromCache(entry.type, entry.id);
      if (cacheEntry) {
        switch (entry.type) {
          case MemoryType.GAME_KNOWLEDGE:
            contextCache.gameKnowledge.push(cacheEntry as CacheEntry<GameKnowledgeMemory>);
            break;
          case MemoryType.COACHING_INSIGHTS:
            contextCache.applicableInsights.push(cacheEntry as CacheEntry<CoachingInsightsMemory>);
            break;
        }

        contextCache.lastUsed = Date.now();
        contextCache.timesReferenced++;
      }
    }
  }

  private cleanupIndexes(): number {
    let cleaned = 0;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup player index
    for (const [steamId, playerCache] of this.playerIndex) {
      if (now - playerCache.lastActivity > maxAge) {
        this.playerIndex.delete(steamId);
        cleaned++;
      }
    }

    // Cleanup session index
    for (const [sessionId, sessionCache] of this.sessionIndex) {
      if (!sessionCache.isActive && now - sessionCache.lastUpdateTime > maxAge) {
        this.sessionIndex.delete(sessionId);
        cleaned++;
      }
    }

    // Cleanup context index
    for (const [context, contextCache] of this.contextIndex) {
      if (now - contextCache.lastUsed > maxAge) {
        this.contextIndex.delete(context);
        cleaned++;
      }
    }

    return cleaned;
  }

  private async cleanupPlayerIndex(steamId: string, entryId: string): Promise<void> {
    const playerCache = this.playerIndex.get(steamId);
    if (!playerCache) return;

    // Remove entry from player cache
    if (playerCache.profile?.data.id === entryId) {
      playerCache.profile = undefined;
    }

    playerCache.recentInteractions = playerCache.recentInteractions.filter(
      interaction => interaction.data.id !== entryId
    );

    if (playerCache.currentSession?.data.id === entryId) {
      playerCache.currentSession = undefined;
    }

    playerCache.activeInsights = playerCache.activeInsights.filter(
      insight => insight.data.id !== entryId
    );

    // Update memory usage
    playerCache.totalMemoryUsage = this.calculatePlayerMemoryUsage(playerCache);
  }

  private async cleanupSessionIndex(sessionId: string, entryId: string): Promise<void> {
    const sessionCache = this.sessionIndex.get(sessionId);
    if (!sessionCache) return;

    // Remove entry from session cache
    if (sessionCache.sessionData?.data.id === entryId) {
      sessionCache.sessionData = {} as CacheEntry<SessionDataMemory>;
    }

    sessionCache.contextualKnowledge = sessionCache.contextualKnowledge.filter(
      knowledge => knowledge.data.id !== entryId
    );

    sessionCache.realtimeInsights = sessionCache.realtimeInsights.filter(
      insight => insight.data.id !== entryId
    );

    // Update memory usage
    sessionCache.memoryUsage = this.calculateSessionMemoryUsage(sessionCache);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  private initializeStatistics(): void {
    // Initialize performance statistics
    const stats = ['cache_hits', 'cache_misses', 'evictions', 'memory_usage'];
    for (const stat of stats) {
      this.statistics.set(stat, 0);
    }
  }

  private updateGlobalStats(): void {
    const caches = this.getAllCaches();
    
    let totalMemory = 0;
    let totalEntries = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const cache of caches) {
      const stats = cache.getStats();
      totalMemory += stats.memoryUsage;
      totalEntries += stats.totalEntries;
      totalHits += stats.hitCount;
      totalMisses += stats.missCount;
    }

    this.globalStats.totalMemoryUsage = totalMemory;
    this.globalStats.totalEntries = totalEntries;
    this.globalStats.globalHitRate = totalHits / Math.max(1, totalHits + totalMisses);
  }

  private updateAccessStats(entryId: string, hit: boolean): void {
    const stat = hit ? 'cache_hits' : 'cache_misses';
    this.statistics.set(stat, (this.statistics.get(stat) || 0) + 1);
  }

  private checkMemoryConstraints(additionalSize: number): boolean {
    const totalMemoryMB = (this.globalStats.totalMemoryUsage + additionalSize) / (1024 * 1024);
    return totalMemoryMB <= this.config.globalMaxMemoryMB;
  }

  private getDefaultTTL(type: MemoryType): number {
    const config = DEFAULT_CACHE_CONFIG[type];
    return config ? config.defaultTTL : 60 * 60 * 1000; // 1 hour default
  }

  private extractPlayerId(entry: BaseMemoryEntry): string | undefined {
    // Extract player ID from different memory types
    if ('steamId' in (entry as any).data) {
      return (entry as any).data.steamId;
    }
    if ('playerId' in (entry as any).data) {
      return (entry as any).data.playerId;
    }
    return undefined;
  }

  private extractSessionId(entry: BaseMemoryEntry): string | undefined {
    // Extract session ID from different memory types
    if ('sessionId' in (entry as any).data) {
      return (entry as any).data.sessionId;
    }
    return undefined;
  }

  private extractPlayerName(entry: BaseMemoryEntry): string | undefined {
    // Extract player name from different memory types
    if ('playerName' in (entry as any).data) {
      return (entry as any).data.playerName;
    }
    return undefined;
  }

  private extractContexts(entry: BaseMemoryEntry): string[] {
    const contexts: string[] = [];
    
    // Extract contextual information for indexing
    if (entry.type === MemoryType.GAME_KNOWLEDGE) {
      const data = (entry as any).data;
      if (data.mapSpecific) {
        contexts.push(...data.mapSpecific.map((map: string) => `map:${map}`));
      }
      if (data.situationSpecific) {
        contexts.push(...data.situationSpecific.map((situation: string) => `situation:${situation}`));
      }
      if (data.teamSide) {
        contexts.push(`side:${data.teamSide}`);
      }
    }
    
    return contexts;
  }

  private hasAnyTag(entryTags: string[], filterTags: string[]): boolean {
    return filterTags.some(tag => entryTags.includes(tag));
  }

  private getSortValue(entry: CacheEntry<any>, sortBy: string): number {
    switch (sortBy) {
      case 'createdAt':
        return entry.data.createdAt.getTime();
      case 'updatedAt':
        return entry.data.updatedAt.getTime();
      case 'importance':
        return this.getImportanceScore(entry.data.importance);
      case 'relevance':
        return entry.priority;
      default:
        return entry.timestamp;
    }
  }

  private getImportanceScore(importance: MemoryImportance): number {
    switch (importance) {
      case MemoryImportance.CRITICAL: return 5;
      case MemoryImportance.HIGH: return 4;
      case MemoryImportance.MEDIUM: return 3;
      case MemoryImportance.LOW: return 2;
      case MemoryImportance.TEMPORARY: return 1;
      default: return 3;
    }
  }

  private calculatePlayerMemoryUsage(playerCache: PlayerCache): number {
    let usage = 0;
    
    if (playerCache.profile) usage += playerCache.profile.size;
    usage += playerCache.recentInteractions.reduce((sum, entry) => sum + entry.size, 0);
    if (playerCache.currentSession) usage += playerCache.currentSession.size;
    usage += playerCache.activeInsights.reduce((sum, entry) => sum + entry.size, 0);
    
    return usage;
  }

  private calculateSessionMemoryUsage(sessionCache: SessionCache): number {
    let usage = 0;
    
    if (sessionCache.sessionData.size) usage += sessionCache.sessionData.size;
    usage += sessionCache.contextualKnowledge.reduce((sum, entry) => sum + entry.size, 0);
    usage += sessionCache.realtimeInsights.reduce((sum, entry) => sum + entry.size, 0);
    
    return usage;
  }
}

// ===== Factory Function =====

/**
 * Create and initialize a new ShortTermMemoryManager instance
 */
export async function createShortTermMemoryManager(
  config?: Partial<ShortTermMemoryConfig>
): Promise<ShortTermMemoryManagerImpl> {
  const manager = new ShortTermMemoryManagerImpl(config);
  await manager.initialize();
  return manager;
}

// ===== Export Default Instance =====

/**
 * Default short-term memory manager instance (singleton pattern)
 */
let defaultManager: ShortTermMemoryManagerImpl | null = null;

/**
 * Get the default short-term memory manager instance
 */
export async function getDefaultShortTermMemoryManager(): Promise<ShortTermMemoryManagerImpl> {
  if (!defaultManager) {
    defaultManager = await createShortTermMemoryManager();
  }
  return defaultManager;
} 