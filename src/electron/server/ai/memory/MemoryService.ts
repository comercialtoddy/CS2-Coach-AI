/**
 * Unified Memory Service Implementation
 * 
 * This service provides a unified interface for all memory operations, coordinating
 * between short-term (cache) and long-term (database) memory systems with intelligent
 * querying, caching strategies, and performance optimization.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ShortTermMemoryManagerImpl, getDefaultShortTermMemoryManager } from './ShortTermMemoryManager.js';
import { LongTermMemoryManager, getDefaultLongTermMemoryManager } from './LongTermMemoryManager.js';
import {
  BaseMemoryEntry,
  MemoryType,
  MemoryImportance,
  PlayerProfileMemory,
  InteractionHistoryMemory,
  GameKnowledgeType,
  GameKnowledgeMemory,
  SessionDataMemory,
  CoachingInsightsMemory,
  MemoryQueryOptions,
  MemorySearchOptions,
  MemoryStorageOptions,
  MemoryRetrievalResult,
  MemoryServiceStatus,
  IMemoryService
} from '../interfaces/MemoryService.js';

/**
 * Configuration for the unified memory service
 */
export interface MemoryServiceConfig {
  enableShortTermMemory: boolean;
  enableLongTermMemory: boolean;
  autoPromotionEnabled: boolean;
  promotionThreshold: number;         // Access count threshold for promotion
  preloadStrategy: 'aggressive' | 'conservative' | 'none';
  queryTimeout: number;               // Query timeout in milliseconds
  batchSize: number;                  // Batch size for bulk operations
  debugMode: boolean;
}

/**
 * Default configuration for memory service
 */
const DEFAULT_CONFIG: MemoryServiceConfig = {
  enableShortTermMemory: true,
  enableLongTermMemory: true,
  autoPromotionEnabled: true,
  promotionThreshold: 3,              // Promote after 3 accesses
  preloadStrategy: 'conservative',
  queryTimeout: 10000,                // 10 seconds
  batchSize: 50,
  debugMode: false
};

/**
 * Memory operation statistics
 */
interface MemoryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  promotions: number;
  averageQueryTime: number;
  errorCount: number;
}

/**
 * Query strategy for optimization
 */
interface QueryStrategy {
  preferCache: boolean;
  combineResults: boolean;
  promotionCandidate: boolean;
  maxResults?: number;
  timeoutMs?: number;
}

/**
 * Unified Memory Service Implementation
 * 
 * Provides a single interface for all memory operations while intelligently
 * managing data between short-term cache and long-term database storage.
 */
export class MemoryService extends EventEmitter implements IMemoryService {
  private shortTermManager: ShortTermMemoryManagerImpl | null = null;
  private longTermManager: LongTermMemoryManager | null = null;
  private config: MemoryServiceConfig;
  private initialized: boolean = false;
  private stats: MemoryStats;
  private accessTracker: Map<string, number> = new Map();

  constructor(config: Partial<MemoryServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      promotions: 0,
      averageQueryTime: 0,
      errorCount: 0
    };

    if (this.config.debugMode) {
      console.log('🧠 MemoryService initialized with config:', this.config);
    }
  }

  // ===== Initialization and Lifecycle =====

  /**
   * Initialize the memory service and all subsystems
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️ MemoryService already initialized');
      return;
    }

    console.log('🚀 Initializing MemoryService...');

    try {
      // Initialize short-term memory manager
      if (this.config.enableShortTermMemory) {
        this.shortTermManager = await getDefaultShortTermMemoryManager();
        console.log('✅ Short-term memory manager initialized');
      }

      // Initialize long-term memory manager
      if (this.config.enableLongTermMemory) {
        this.longTermManager = await getDefaultLongTermMemoryManager();
        console.log('✅ Long-term memory manager initialized');
      }

      // Start background processes
      this.startBackgroundProcesses();

      this.initialized = true;
      this.emit('initialized');
      
      console.log('✅ MemoryService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MemoryService:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Dispose of the memory service and all subsystems
   */
  async dispose(): Promise<void> {
    console.log('🛑 Disposing MemoryService...');

    this.initialized = false;

    // Dispose subsystems
    if (this.shortTermManager) {
      await this.shortTermManager.dispose();
      this.shortTermManager = null;
    }

    if (this.longTermManager) {
      await this.longTermManager.dispose();
      this.longTermManager = null;
    }

    // Clear tracking data
    this.accessTracker.clear();

    this.emit('disposed');
    console.log('✅ MemoryService disposed successfully');
  }

  // ===== Core Memory Operations =====

  /**
   * Store a memory entry with intelligent placement strategy
   */
  async store<T extends BaseMemoryEntry>(
    entry: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    options: MemoryStorageOptions = {}
  ): Promise<string> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      let entryId: string;

      // Always store in long-term memory first for persistence
      if (this.longTermManager) {
        entryId = await this.longTermManager.store(entry, options);
      } else {
        entryId = uuidv4();
      }

      // Create full entry with generated ID for short-term storage
      const fullEntry: T = {
        id: entryId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entry
      } as T;

      // Store in short-term memory based on importance and strategy
      if (this.shortTermManager && this.shouldCacheEntry(fullEntry)) {
        await this.shortTermManager.store(fullEntry, { 
          forceEviction: entry.importance === MemoryImportance.CRITICAL 
        });
      }

      // Update statistics
      this.updateStats('store', Date.now() - startTime);

      if (this.config.debugMode) {
        console.log(`✅ Stored memory entry: ${entryId} (type: ${entry.type})`);
      }

      this.emit('stored', { entryId, type: entry.type });
      return entryId;
    } catch (error) {
      console.error('❌ Error storing memory entry:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Retrieve a memory entry with intelligent cache-first strategy
   */
  async get<T extends BaseMemoryEntry>(entryId: string, type?: MemoryType): Promise<T | null> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      this.stats.totalQueries++;
      let result: T | null = null;

      // First, try short-term memory (cache)
      if (this.shortTermManager) {
        result = await this.shortTermManager.get<T>(entryId, type);
        if (result) {
          this.stats.cacheHits++;
          this.trackAccess(entryId);

          // Update statistics and return
          this.updateStats('cache_hit', Date.now() - startTime);
          
          if (this.config.debugMode) {
            console.log(`🎯 Cache hit for entry: ${entryId}`);
          }

          this.emit('retrieved', { entryId, source: 'cache', type: result.type });
          return result;
        }
      }

      // Cache miss - try long-term memory (database)
      this.stats.cacheMisses++;
      
      if (this.longTermManager) {
        result = await this.longTermManager.get<T>(entryId);
        if (result) {
          this.trackAccess(entryId);

          // Consider promoting to cache if accessed frequently
          if (this.shouldPromoteEntry(entryId, result)) {
            await this.promoteToCache(result);
          }

          // Update statistics
          this.updateStats('database_hit', Date.now() - startTime);
          
          if (this.config.debugMode) {
            console.log(`🗄️ Database hit for entry: ${entryId}`);
          }

          this.emit('retrieved', { entryId, source: 'database', type: result.type });
          return result;
        }
      }

      // Entry not found
      this.updateStats('miss', Date.now() - startTime);
      
      if (this.config.debugMode) {
        console.log(`❌ Entry not found: ${entryId}`);
      }

      this.emit('notFound', { entryId });
      return null;
    } catch (error) {
      console.error('❌ Error retrieving memory entry:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Update a memory entry in both systems
   */
  async update<T extends BaseMemoryEntry>(
    entryId: string,
    updates: Partial<T>,
    options: MemoryStorageOptions = {}
  ): Promise<boolean> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      let success = false;

      // Update in long-term memory first
      if (this.longTermManager) {
        success = await this.longTermManager.update(entryId, updates, options);
      }

      // Update in short-term memory if it exists there
      if (this.shortTermManager) {
        const cached = await this.shortTermManager.get(entryId);
        if (cached) {
          await this.shortTermManager.update(entryId, updates);
        }
      }

      // Update statistics
      this.updateStats('update', Date.now() - startTime);

      if (this.config.debugMode && success) {
        console.log(`✅ Updated memory entry: ${entryId}`);
      }

      this.emit('updated', { entryId });
      return success;
    } catch (error) {
      console.error('❌ Error updating memory entry:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Remove a memory entry from both systems
   */
  async remove(entryId: string, type?: MemoryType): Promise<boolean> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      let success = false;

      // Remove from both systems
      if (this.longTermManager) {
        success = await this.longTermManager.delete(entryId);
      }

      if (this.shortTermManager) {
        await this.shortTermManager.remove(entryId, type);
      }

      // Clean up tracking
      this.accessTracker.delete(entryId);

      // Update statistics
      this.updateStats('remove', Date.now() - startTime);

      if (this.config.debugMode && success) {
        console.log(`✅ Removed memory entry: ${entryId}`);
      }

      this.emit('removed', { entryId });
      return success;
    } catch (error) {
      console.error('❌ Error removing memory entry:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      return false;
    }
  }

  // ===== Advanced Query Operations =====

  /**
   * Query memory entries with intelligent result combination
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
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      this.stats.totalQueries++;
      const strategy = this.determineQueryStrategy(filters, options);
      
      let cacheResults: MemoryRetrievalResult<T> | null = null;
      let dbResults: MemoryRetrievalResult<T> | null = null;

      // Query short-term memory first if strategy prefers cache
      if (this.shortTermManager && strategy.preferCache) {
        cacheResults = await this.shortTermManager.query<T>(filters, options);
        
        // If cache has sufficient results, return them
        if (cacheResults.entries.length > 0 && !strategy.combineResults) {
          this.stats.cacheHits++;
          this.updateStats('cache_query', Date.now() - startTime);
          
          // Track access for all returned entries
          cacheResults.entries.forEach(entry => this.trackAccess(entry.id));
          
          this.emit('queried', { source: 'cache', count: cacheResults.entries.length });
          return cacheResults;
        }
      }

      // Query long-term memory
      if (this.longTermManager) {
        dbResults = await this.longTermManager.query<T>(filters, options);
        
        if (dbResults.entries.length > 0) {
          // Track access for database results
          dbResults.entries.forEach(entry => this.trackAccess(entry.id));
          
          // Promote frequently accessed entries to cache
          if (strategy.promotionCandidate) {
            await this.bulkPromoteToCache(dbResults.entries);
          }
        }
      }

      // Combine results if needed
      let finalResults: MemoryRetrievalResult<T>;
      
      if (strategy.combineResults && cacheResults && dbResults) {
        finalResults = this.combineResults(cacheResults, dbResults, options);
      } else {
        finalResults = dbResults || cacheResults || {
          entries: [],
          totalCount: 0,
          hasMore: false,
          searchTime: Date.now() - startTime,
          fromCache: false
        };
      }

      // Update statistics
      const source = cacheResults?.entries.length ? 'cache' : 'database';
      this.updateStats(`${source}_query`, Date.now() - startTime);

      this.emit('queried', { source, count: finalResults.entries.length });
      return finalResults;
    } catch (error) {
      console.error('❌ Error querying memory entries:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      
      return {
        entries: [],
        totalCount: 0,
        hasMore: false,
        searchTime: Date.now() - startTime,
        fromCache: false
      };
    }
  }

  /**
   * Search memory entries with fuzzy matching
   */
  async search<T extends BaseMemoryEntry>(
    searchOptions: MemorySearchOptions
  ): Promise<MemoryRetrievalResult<T>> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      this.stats.totalQueries++;
      
      // Search is primarily handled by long-term memory for comprehensive results
      let results: MemoryRetrievalResult<T>;
      
      if (this.longTermManager) {
        results = await this.longTermManager.search<T>(searchOptions);
        
        // Track access for search results
        results.entries.forEach(entry => this.trackAccess(entry.id));
        
        // Cache frequently searched results
        if (results.entries.length > 0 && results.entries.length <= 10) {
          await this.bulkPromoteToCache(results.entries);
        }
      } else {
        results = {
          entries: [],
          totalCount: 0,
          hasMore: false,
          searchTime: Date.now() - startTime,
          fromCache: false
        };
      }

      this.updateStats('search', Date.now() - startTime);
      this.emit('searched', { query: searchOptions.query, count: results.entries.length });
      
      return results;
    } catch (error) {
      console.error('❌ Error searching memory entries:', error);
      this.stats.errorCount++;
      this.emit('error', error);
      
      return {
        entries: [],
        totalCount: 0,
        hasMore: false,
        searchTime: Date.now() - startTime,
        fromCache: false
      };
    }
  }

  // ===== Specialized Retrieval Methods =====

  /**
   * Get player profile with cache optimization
   */
  async getPlayerProfile(steamId: string): Promise<PlayerProfileMemory | null> {
    this.ensureInitialized();

    try {
      // Try cache first for player profiles (frequently accessed)
      if (this.shortTermManager) {
        const playerCache = await this.shortTermManager.getPlayerCache(steamId);
        if (playerCache?.profile) {
          this.trackAccess(playerCache.profile.data.id);
          return playerCache.profile.data;
        }
      }

      // Fallback to database
      if (this.longTermManager) {
        const profile = await this.longTermManager.getPlayerProfile(steamId);
        if (profile) {
          this.trackAccess(profile.id);
          
          // Cache for future access
          if (this.shortTermManager) {
            await this.shortTermManager.store(profile);
          }
          
          return profile;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error retrieving player profile:', error);
      this.stats.errorCount++;
      return null;
    }
  }

  /**
   * Get interaction history with intelligent pagination
   */
  async getInteractionHistory(
    steamId: string,
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<InteractionHistoryMemory>> {
    this.ensureInitialized();

    try {
      // For interaction history, combine recent cache data with historical database data
      let cacheResults: InteractionHistoryMemory[] = [];
      
      if (this.shortTermManager) {
        const playerCache = await this.shortTermManager.getPlayerCache(steamId);
        if (playerCache?.recentInteractions) {
          cacheResults = playerCache.recentInteractions.map(entry => entry.data);
        }
      }

      // Get additional history from database
      let dbResults: MemoryRetrievalResult<InteractionHistoryMemory>;
      
      if (this.longTermManager) {
        dbResults = await this.longTermManager.getInteractionHistory(steamId, options);
      } else {
        dbResults = {
          entries: [],
          totalCount: 0,
          hasMore: false,
          searchTime: 0,
          fromCache: false
        };
      }

      // Combine and deduplicate results
      const allEntries = [...cacheResults, ...dbResults.entries];
      const uniqueEntries = this.deduplicateEntries(allEntries);
      
      // Sort by interaction time (most recent first)
      uniqueEntries.sort((a, b) => 
        new Date(b.data.context).getTime() - new Date(a.data.context).getTime()
      );

      return {
        entries: uniqueEntries.slice(0, options.limit || 50),
        totalCount: uniqueEntries.length,
        hasMore: uniqueEntries.length > (options.limit || 50),
        searchTime: dbResults.searchTime,
        fromCache: cacheResults.length > 0
      };
    } catch (error) {
      console.error('❌ Error retrieving interaction history:', error);
      this.stats.errorCount++;
      
      return {
        entries: [],
        totalCount: 0,
        hasMore: false,
        searchTime: 0,
        fromCache: false
      };
    }
  }

  /**
   * Get current session data with real-time cache priority
   */
  async getCurrentSessionData(playerId: string): Promise<SessionDataMemory | null> {
    this.ensureInitialized();

    try {
      // Session data is highly dynamic, prioritize cache
      if (this.shortTermManager) {
        const sessionCaches = Array.from(this.shortTermManager.sessionIndex.values());
        const activeSession = sessionCaches.find(
          session => session.playerId === playerId && session.isActive
        );
        
        if (activeSession?.sessionData?.data) {
          this.trackAccess(activeSession.sessionData.data.id);
          return activeSession.sessionData.data;
        }
      }

      // Fallback to database
      if (this.longTermManager) {
        const sessionData = await this.longTermManager.getCurrentSessionData(playerId);
        if (sessionData) {
          this.trackAccess(sessionData.id);
          
          // Cache for real-time access
          if (this.shortTermManager) {
            await this.shortTermManager.store(sessionData);
          }
          
          return sessionData;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error retrieving current session data:', error);
      this.stats.errorCount++;
      return null;
    }
  }

  // ===== Service Status and Analytics =====

  /**
   * Get comprehensive memory service status
   */
  async getStatus(): Promise<MemoryServiceStatus> {
    this.ensureInitialized();

    try {
      // Get status from both subsystems
      const shortTermStats = this.shortTermManager ? 
        this.shortTermManager.getMemoryStats() : null;
      
      const longTermStatus = this.longTermManager ? 
        await this.longTermManager.getStatus() : null;

      return {
        shortTermMemory: {
          entryCount: shortTermStats?.global.totalEntries || 0,
          memoryUsage: shortTermStats?.global.totalMemoryUsage || 0,
          oldestEntry: undefined, // TODO: Calculate from cache
          newestEntry: undefined  // TODO: Calculate from cache
        },
        longTermMemory: longTermStatus?.longTermMemory || {
          entryCount: 0,
          databaseSize: 0,
          oldestEntry: undefined,
          newestEntry: undefined
        },
        performance: {
          averageRetrievalTime: this.stats.averageQueryTime,
          averageStorageTime: this.stats.averageQueryTime, // Approximation
          cacheHitRate: this.stats.totalQueries > 0 ? 
            this.stats.cacheHits / this.stats.totalQueries : 0
        }
      };
    } catch (error) {
      console.error('❌ Error getting memory service status:', error);
      throw error;
    }
  }

  /**
   * Get detailed service statistics
   */
  getStats(): MemoryStats & { accessPatterns: Array<{ entryId: string; accessCount: number }> } {
    return {
      ...this.stats,
      accessPatterns: Array.from(this.accessTracker.entries())
        .map(([entryId, accessCount]) => ({ entryId, accessCount }))
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10) // Top 10 most accessed
    };
  }

  /**
   * Cleanup expired entries in both systems
   */
  async cleanup(): Promise<{ shortTerm: number; longTerm: number }> {
    this.ensureInitialized();

    try {
      const shortTermCleaned = this.shortTermManager ? 
        await this.shortTermManager.cleanup() : 0;
      
      const longTermCleaned = this.longTermManager ? 
        await this.longTermManager.cleanupExpiredEntries() : 0;

      if (this.config.debugMode) {
        console.log(`🧹 Cleanup completed: ${shortTermCleaned} cache, ${longTermCleaned} database`);
      }

      this.emit('cleanup', { shortTerm: shortTermCleaned, longTerm: longTermCleaned });
      
      return { shortTerm: shortTermCleaned, longTerm: longTermCleaned };
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      this.stats.errorCount++;
      return { shortTerm: 0, longTerm: 0 };
    }
  }

  // ===== Interface Compliance Helper Aliases =====

  /**
   * Alias for remove() to satisfy IMemoryService.delete
   */
  public async delete(entryId: string): Promise<boolean> {
    return this.remove(entryId);
  }

  public async getGameKnowledge(
    knowledgeType?: GameKnowledgeType,
    context: { mapName?: string; situation?: string } = {},
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<GameKnowledgeMemory>> {
    this.ensureInitialized();
    if (this.longTermManager) {
      return this.longTermManager.getGameKnowledge(knowledgeType, context, options);
    }
    return { entries: [], totalCount: 0, hasMore: false, searchTime: 0, fromCache: false };
  }

  public async getSessionData(sessionId: string): Promise<SessionDataMemory | null> {
    this.ensureInitialized();
    // Check cache first
    if (this.shortTermManager) {
      const cacheHit = await this.shortTermManager.get<SessionDataMemory>(sessionId, MemoryType.SESSION_DATA);
      if (cacheHit) return cacheHit;
    }
    // Fallback to DB
    return this.longTermManager ? this.longTermManager.getSessionData(sessionId) : null;
  }

  public async getCoachingInsights(
    playerId: string,
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<CoachingInsightsMemory>> {
    this.ensureInitialized();
    if (this.longTermManager) {
      return this.longTermManager.getCoachingInsights(playerId, options);
    }
    return { entries: [], totalCount: 0, hasMore: false, searchTime: 0, fromCache: false };
  }

  public async getContextualMemories(
    context: {
      playerId: string;
      currentSituation?: string;
      mapName?: string;
      recentTopics?: string[];
    },
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult> {
    // Basic implementation delegates to query with filters and tags
    const filters: any = { steamId: context.playerId };
    if (context.recentTopics?.length) filters.tags = context.recentTopics;
    return this.query(filters, options);
  }

  public async cleanupExpiredEntries(): Promise<number> {
    this.ensureInitialized();
    return this.longTermManager ? this.longTermManager.cleanupExpiredEntries() : 0;
  }

  public async promoteToLongTerm(entryId: string): Promise<boolean> {
    // In this simplified implementation, all entries are already persisted when stored.
    // Return true if entry exists.
    this.ensureInitialized();
    return (!!(await this.get(entryId)));
  }

  public async demoteToShortTerm(entryId: string): Promise<boolean> {
    // Not currently supported – no-op.
    return false;
  }

  public async getMemoryUsage(): Promise<{ shortTerm: number; longTerm: number }> {
    this.ensureInitialized();
    const shortTerm = this.shortTermManager ? this.shortTermManager.getMemoryStats().global.totalMemoryUsage : 0;
    const longTermStatus = this.longTermManager ? await this.longTermManager.getStatus() : null;
    const longTerm = longTermStatus?.longTermMemory.databaseSize || 0;
    return { shortTerm, longTerm };
  }

  public async clearShortTermMemory(): Promise<void> {
    this.ensureInitialized();
    this.shortTermManager?.clearAllCaches();
  }

  public async warmupCache(_steamId?: string): Promise<void> {
    // TODO: implement smarter warmup strategies
    return;
  }

  public async exportMemories(
    _filters?: { type?: MemoryType; steamId?: string },
    _format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    // Simple JSON export for now
    const all = await this.query({}, { limit: 1000 });
    return JSON.stringify(all.entries, null, 2);
  }

  public async importMemories(_data: string | BaseMemoryEntry[]): Promise<number> {
    // TODO: implement bulk import
    return 0;
  }

  public async healthCheck(): Promise<{ healthy: boolean; message?: string; details?: Record<string, any> }> {
    const healthy = this.initialized;
    return { healthy, message: healthy ? 'MemoryService operational' : 'MemoryService not initialized' };
  }

  /**
   * Alias for the search method for backward compatibility.
   */
  async searchMemory<T extends BaseMemoryEntry>(
    searchOptions: MemorySearchOptions
  ): Promise<MemoryRetrievalResult<T>> {
    return this.search(searchOptions);
  }

  /**
   * Clears all memory from both short-term and long-term storage.
   * A simple alias for the cleanup method.
   */
  async clearMemory(): Promise<void> {
    await this.cleanup();
  }

  // ===== Private Helper Methods =====

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MemoryService is not initialized. Call initialize() first.');
    }
  }

  private shouldCacheEntry<T extends BaseMemoryEntry>(entry: T): boolean {
    // Cache based on importance and type
    if (entry.importance === MemoryImportance.CRITICAL || 
        entry.importance === MemoryImportance.HIGH) {
      return true;
    }

    // Cache session data and recent interactions
    if (entry.type === MemoryType.SESSION_DATA || 
        entry.type === MemoryType.COACHING_INSIGHTS) {
      return true;
    }

    // Cache player profiles for active players
    if (entry.type === MemoryType.PLAYER_PROFILE) {
      return true;
    }

    return false;
  }

  private shouldPromoteEntry<T extends BaseMemoryEntry>(entryId: string, entry: T): boolean {
    if (!this.config.autoPromotionEnabled) return false;
    
    const accessCount = this.accessTracker.get(entryId) || 0;
    return accessCount >= this.config.promotionThreshold;
  }

  private async promoteToCache<T extends BaseMemoryEntry>(entry: T): Promise<void> {
    if (!this.shortTermManager) return;

    try {
      const success = await this.shortTermManager.store(entry, { forceEviction: false });
      if (success) {
        this.stats.promotions++;
        
        if (this.config.debugMode) {
          console.log(`⬆️ Promoted entry to cache: ${entry.id}`);
        }
        
        this.emit('promoted', { entryId: entry.id, type: entry.type });
      }
    } catch (error) {
      console.error('❌ Error promoting entry to cache:', error);
    }
  }

  private async bulkPromoteToCache<T extends BaseMemoryEntry>(entries: T[]): Promise<void> {
    if (!this.shortTermManager || entries.length === 0) return;

    const promotionPromises = entries
      .filter(entry => this.shouldPromoteEntry(entry.id, entry))
      .slice(0, 10) // Limit bulk promotions
      .map(entry => this.promoteToCache(entry));

    await Promise.allSettled(promotionPromises);
  }

  private trackAccess(entryId: string): void {
    const currentCount = this.accessTracker.get(entryId) || 0;
    this.accessTracker.set(entryId, currentCount + 1);
  }

  private determineQueryStrategy(
    filters: any, 
    options: MemoryQueryOptions
  ): QueryStrategy {
    // Prefer cache for recent data and small result sets
    const preferCache = (options.limit || 50) <= 20 && 
                       filters.sessionId !== undefined;

    // Combine results for comprehensive queries
    const combineResults = (options.limit || 50) > 50 || 
                          filters.tags !== undefined;

    // Consider promotion for filtered queries
    const promotionCandidate = filters.steamId !== undefined || 
                              filters.sessionId !== undefined;

    return {
      preferCache,
      combineResults,
      promotionCandidate,
      maxResults: options.limit,
      timeoutMs: this.config.queryTimeout
    };
  }

  private combineResults<T extends BaseMemoryEntry>(
    cacheResults: MemoryRetrievalResult<T>,
    dbResults: MemoryRetrievalResult<T>,
    options: MemoryQueryOptions
  ): MemoryRetrievalResult<T> {
    // Combine and deduplicate entries
    const allEntries = [...cacheResults.entries, ...dbResults.entries];
    const uniqueEntries = this.deduplicateEntries(allEntries);

    // Apply sorting and pagination
    const sortedEntries = this.sortEntries(uniqueEntries, options.sortBy, options.sortOrder);
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    return {
      entries: sortedEntries.slice(offset, offset + limit),
      totalCount: Math.max(cacheResults.totalCount, dbResults.totalCount),
      hasMore: sortedEntries.length > offset + limit,
      searchTime: Math.max(cacheResults.searchTime, dbResults.searchTime),
      fromCache: cacheResults.entries.length > 0
    };
  }

  private deduplicateEntries<T extends BaseMemoryEntry>(entries: T[]): T[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }

  private sortEntries<T extends BaseMemoryEntry>(
    entries: T[], 
    sortBy?: string, 
    sortOrder?: 'asc' | 'desc'
  ): T[] {
    if (!sortBy) return entries;

    return entries.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        case 'importance':
          const importanceOrder = {
            [MemoryImportance.CRITICAL]: 5,
            [MemoryImportance.HIGH]: 4,
            [MemoryImportance.MEDIUM]: 3,
            [MemoryImportance.LOW]: 2,
            [MemoryImportance.TEMPORARY]: 1
          };
          aValue = importanceOrder[a.importance];
          bValue = importanceOrder[b.importance];
          break;
        default:
          return 0;
      }

      const order = sortOrder === 'asc' ? 1 : -1;
      return aValue < bValue ? -order : aValue > bValue ? order : 0;
    });
  }

  private updateStats(operation: string, duration: number): void {
    // Update average query time
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + duration) / 
      this.stats.totalQueries;
  }

  private startBackgroundProcesses(): void {
    // Periodic cleanup
    setInterval(async () => {
      await this.cleanup();
    }, 60000); // Every minute

    // Periodic access pattern optimization
    setInterval(() => {
      this.optimizeAccessPatterns();
    }, 300000); // Every 5 minutes
  }

  private optimizeAccessPatterns(): void {
    // Clean up old access tracking data
    const threshold = 100; // Keep top 100 most accessed
    if (this.accessTracker.size > threshold) {
      const sorted = Array.from(this.accessTracker.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, threshold);
      
      this.accessTracker.clear();
      sorted.forEach(([entryId, count]) => {
        this.accessTracker.set(entryId, count);
      });
    }
  }
}

// ===== Factory Function =====

/**
 * Create and initialize a new MemoryService instance
 */
export async function createMemoryService(
  config?: Partial<MemoryServiceConfig>
): Promise<MemoryService> {
  const service = new MemoryService(config);
  await service.initialize();
  return service;
}

// ===== Export Default Instance =====

/**
 * Default memory service instance (singleton pattern)
 */
let defaultService: MemoryService | null = null;

/**
 * Get the default memory service instance
 */
export async function getDefaultMemoryService(): Promise<MemoryService> {
  if (!defaultService) {
    defaultService = await createMemoryService();
  }
  return defaultService;
} 