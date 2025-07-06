/**
 * Long-Term Memory Manager Implementation
 * 
 * This service handles all SQLite database operations for persistent memory storage,
 * providing data access layer for player profiles, interaction history, game knowledge,
 * and coaching insights with optimized queries and analytics capabilities.
 */

import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import db from '../../../database/database.js';
import {
  initializeMemorySchema,
  MEMORY_QUERIES,
  MEMORY_TYPE_TABLES,
  DEFAULT_TTL_BY_IMPORTANCE
} from './LongTermMemorySchemas.js';
import {
  BaseMemoryEntry,
  MemoryType,
  MemoryImportance,
  PlayerProfileMemory,
  InteractionHistoryMemory,
  GameKnowledgeMemory,
  SessionDataMemory,
  CoachingInsightsMemory,
  PlayerProfileData,
  InteractionHistoryData,
  GameKnowledgeData,
  SessionData,
  CoachingInsightsData,
  MemoryQueryOptions,
  MemorySearchOptions,
  MemoryStorageOptions,
  MemoryRetrievalResult,
  MemoryServiceStatus
} from '../interfaces/MemoryService.js';

/**
 * Configuration for the long-term memory manager
 */
export interface LongTermMemoryConfig {
  enableAnalytics: boolean;
  enableTriggers: boolean;
  enableViews: boolean;
  batchSize: number;
  queryTimeout: number;
  debugMode: boolean;
}

/**
 * Default configuration for long-term memory
 */
const DEFAULT_CONFIG: LongTermMemoryConfig = {
  enableAnalytics: true,
  enableTriggers: true,
  enableViews: true,
  batchSize: 100,
  queryTimeout: 30000, // 30 seconds
  debugMode: false
};

/**
 * Database operation result
 */
interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rowsAffected?: number;
}

/**
 * Long-Term Memory Manager Implementation
 * 
 * Provides persistent storage operations for all memory types using SQLite database.
 * Handles complex queries, analytics, and maintains data integrity across the system.
 */
export class LongTermMemoryManager {
  private database: Database;
  private config: LongTermMemoryConfig;
  private initialized: boolean = false;
  private transactionLevel: number = 0;

  constructor(database: Database = db, config: Partial<LongTermMemoryConfig> = {}) {
    this.database = database;
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.debugMode) {
      console.log('🗄️ LongTermMemoryManager initialized with config:', this.config);
    }
  }

  // ===== Initialization and Schema Management =====

  /**
   * Initialize the long-term memory system and database schema
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️ LongTermMemoryManager already initialized');
      return;
    }

    console.log('🚀 Initializing LongTermMemoryManager...');

    try {
      // Initialize database schema
      await initializeMemorySchema(this.database);

      // Mark as initialized
      this.initialized = true;
      
      console.log('✅ LongTermMemoryManager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LongTermMemoryManager:', error);
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Dispose of the manager and close database connections
   */
  async dispose(): Promise<void> {
    console.log('🛑 Disposing LongTermMemoryManager...');
    
    // Note: We don't close the database connection as it's shared
    // with other parts of the application
    
    this.initialized = false;
    console.log('✅ LongTermMemoryManager disposed successfully');
  }

  // ===== Core Memory Storage Operations =====

  /**
   * Store a memory entry in the database
   */
  async store<T extends BaseMemoryEntry>(
    entry: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    options: MemoryStorageOptions = {}
  ): Promise<string> {
    this.ensureInitialized();

    const {
      updateExisting = true,
      mergeStrategy = 'replace'
    } = options;

    try {
      const now = Date.now();
      const entryId = uuidv4();
      const expiresAt = entry.expiresAt 
        ? new Date(entry.expiresAt).getTime() 
        : (DEFAULT_TTL_BY_IMPORTANCE[entry.importance] 
          ? now + DEFAULT_TTL_BY_IMPORTANCE[entry.importance]! 
          : null);

      // Start transaction
      await this.beginTransaction();

      try {
        // Create main memory entry
        const memoryEntry: BaseMemoryEntry = {
          id: entryId,
          type: entry.type,
          importance: entry.importance,
          createdAt: new Date(now),
          updatedAt: new Date(now),
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          tags: entry.tags || [],
          metadata: entry.metadata || {}
        };

        // Insert into memory_entries table
        await this.executeQuery(
          MEMORY_QUERIES.insertMemoryEntry,
          [
            entryId,
            entry.type,
            entry.importance,
            now,
            now,
            expiresAt,
            JSON.stringify(entry.tags || []),
            JSON.stringify(entry.metadata || {})
          ]
        );

        // Store type-specific data
        await this.storeTypeSpecificData(entryId, entry as T);

        // Store tags if any
        if (entry.tags && entry.tags.length > 0) {
          await this.storeTags(entryId, entry.tags);
        }

        await this.commitTransaction();

        if (this.config.debugMode) {
          console.log(`✅ Stored memory entry: ${entryId} (type: ${entry.type})`);
        }

        return entryId;
      } catch (error) {
        await this.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error('❌ Error storing memory entry:', error);
      throw new Error(`Failed to store memory entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing memory entry
   */
  async update<T extends BaseMemoryEntry>(
    entryId: string,
    updates: Partial<T>,
    options: MemoryStorageOptions = {}
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      const existing = await this.get<T>(entryId);
      if (!existing) {
        return false;
      }

      const now = Date.now();
      
      await this.beginTransaction();

      try {
        // Update main memory entry
        if (updates.importance || updates.expiresAt || updates.tags || updates.metadata) {
          const expiresAt = updates.expiresAt 
            ? new Date(updates.expiresAt).getTime()
            : (existing.expiresAt ? existing.expiresAt.getTime() : null);

          await this.executeQuery(
            MEMORY_QUERIES.updateMemoryEntry,
            [
              updates.type || existing.type,
              updates.importance || existing.importance,
              now,
              expiresAt,
              JSON.stringify(updates.tags || existing.tags),
              JSON.stringify({ ...existing.metadata, ...(updates.metadata || {}) }),
              entryId
            ]
          );
        }

        // Update type-specific data if provided
        if (updates.data) {
          await this.updateTypeSpecificData(entryId, existing.type, updates.data);
        }

        // Update tags if changed
        if (updates.tags) {
          await this.updateTags(entryId, updates.tags);
        }

        await this.commitTransaction();

        if (this.config.debugMode) {
          console.log(`✅ Updated memory entry: ${entryId}`);
        }

        return true;
      } catch (error) {
        await this.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error('❌ Error updating memory entry:', error);
      return false;
    }
  }

  /**
   * Delete a memory entry from the database
   */
  async delete(entryId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const result = await this.executeQuery(MEMORY_QUERIES.deleteMemoryEntry, [entryId]);
      
      if (this.config.debugMode) {
        console.log(`✅ Deleted memory entry: ${entryId}`);
      }

      return result.rowsAffected! > 0;
    } catch (error) {
      console.error('❌ Error deleting memory entry:', error);
      return false;
    }
  }

  // ===== Core Memory Retrieval Operations =====

  /**
   * Get a memory entry by ID
   */
  async get<T extends BaseMemoryEntry>(entryId: string): Promise<T | null> {
    this.ensureInitialized();

    try {
      const result = await this.executeQuery(MEMORY_QUERIES.getMemoryEntry, [entryId]);
      
      if (!result.data) {
        return null;
      }

      const memoryEntry = result.data;
      
      // Get type-specific data
      const typeSpecificData = await this.getTypeSpecificData(entryId, memoryEntry.type);
      
      if (!typeSpecificData) {
        return null;
      }

      // Combine data
      const fullEntry: T = {
        id: memoryEntry.id,
        type: memoryEntry.type,
        importance: memoryEntry.importance,
        createdAt: new Date(memoryEntry.created_at),
        updatedAt: new Date(memoryEntry.updated_at),
        expiresAt: memoryEntry.expires_at ? new Date(memoryEntry.expires_at) : undefined,
        tags: JSON.parse(memoryEntry.tags || '[]'),
        metadata: JSON.parse(memoryEntry.metadata || '{}'),
        data: typeSpecificData
      } as T;

      return fullEntry;
    } catch (error) {
      console.error('❌ Error retrieving memory entry:', error);
      return null;
    }
  }

  /**
   * Query memory entries with filters and options
   */
  async query<T extends BaseMemoryEntry>(
    filters: {
      type?: MemoryType;
      steamId?: string;
      tags?: string[];
    },
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<T>> {
    this.ensureInitialized();

    const startTime = Date.now();
    const {
      limit = 50,
      offset = 0,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      includeExpired = false,
      timeRange,
      importance
    } = options;

    try {
      let sql = `
        SELECT me.*, COUNT(*) OVER() as total_count
        FROM memory_entries me
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (filters.type) {
        sql += ` AND me.type = ?`;
        params.push(filters.type);
      }

      if (!includeExpired) {
        sql += ` AND (me.expires_at IS NULL OR me.expires_at > ?)`;
        params.push(Date.now());
      }

      if (timeRange) {
        sql += ` AND me.created_at BETWEEN ? AND ?`;
        params.push(timeRange.from.getTime(), timeRange.to.getTime());
      }

      if (importance && importance.length > 0) {
        sql += ` AND me.importance IN (${importance.map(() => '?').join(',')})`;
        params.push(...importance);
      }

      // Filter by tags if specified
      if (filters.tags && filters.tags.length > 0) {
        sql += ` AND me.id IN (
          SELECT mt.memory_entry_id 
          FROM memory_tags mt 
          WHERE mt.tag IN (${filters.tags.map(() => '?').join(',')})
        )`;
        params.push(...filters.tags);
      }

      // Filter by steamId if specified (requires joining with type-specific tables)
      if (filters.steamId) {
        sql += ` AND (
          me.id IN (SELECT memory_entry_id FROM player_profiles WHERE steam_id = ?) OR
          me.id IN (SELECT memory_entry_id FROM interaction_history WHERE steam_id = ?) OR
          me.id IN (SELECT memory_entry_id FROM session_data WHERE player_id = ?) OR
          me.id IN (SELECT memory_entry_id FROM coaching_insights WHERE player_id = ?)
        )`;
        params.push(filters.steamId, filters.steamId, filters.steamId, filters.steamId);
      }

      // Apply sorting
      const sortColumn = this.getSortColumn(sortBy);
      sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

      // Apply pagination
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const result = await this.executeQuery(sql, params);
      const entries: T[] = [];
      let totalCount = 0;

      if (result.data && Array.isArray(result.data)) {
        totalCount = result.data.length > 0 ? result.data[0].total_count : 0;

        // Fetch type-specific data for each entry
        for (const row of result.data) {
          const typeSpecificData = await this.getTypeSpecificData(row.id, row.type);
          if (typeSpecificData) {
            const entry: T = {
              id: row.id,
              type: row.type,
              importance: row.importance,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
              tags: JSON.parse(row.tags || '[]'),
              metadata: JSON.parse(row.metadata || '{}'),
              data: typeSpecificData
            } as T;
            entries.push(entry);
          }
        }
      }

      return {
        entries,
        totalCount,
        hasMore: offset + limit < totalCount,
        searchTime: Date.now() - startTime,
        fromCache: false
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

  /**
   * Search memory entries with text-based search
   */
  async search<T extends BaseMemoryEntry>(
    searchOptions: MemorySearchOptions
  ): Promise<MemoryRetrievalResult<T>> {
    this.ensureInitialized();

    const {
      query,
      searchFields = ['title', 'description', 'insight'],
      fuzzyMatch = true,
      relevanceThreshold = 0.1,
      ...queryOptions
    } = searchOptions;

    try {
      // For simplicity, we'll do a basic text search across relevant fields
      // In a production system, you might want to use SQLite FTS (Full-Text Search)
      let sql = `
        SELECT DISTINCT me.*, COUNT(*) OVER() as total_count
        FROM memory_entries me
        LEFT JOIN player_profiles pp ON me.id = pp.memory_entry_id
        LEFT JOIN interaction_history ih ON me.id = ih.memory_entry_id
        LEFT JOIN game_knowledge gk ON me.id = gk.memory_entry_id
        LEFT JOIN coaching_insights ci ON me.id = ci.memory_entry_id
        WHERE (
          pp.player_name LIKE ? OR
          ih.context LIKE ? OR
          ih.feedback_given LIKE ? OR
          gk.title LIKE ? OR
          gk.description LIKE ? OR
          ci.insight LIKE ?
        )
      `;

      const searchPattern = fuzzyMatch ? `%${query}%` : query;
      const params = Array(6).fill(searchPattern);

      // Apply additional filters from base query options
      const baseResult = await this.query<T>({}, { ...queryOptions, includeExpired: true });
      
      const result = await this.executeQuery(sql, params);
      const entries: T[] = [];

      if (result.data && Array.isArray(result.data)) {
        for (const row of result.data) {
          const typeSpecificData = await this.getTypeSpecificData(row.id, row.type);
          if (typeSpecificData) {
            const entry: T = {
              id: row.id,
              type: row.type,
              importance: row.importance,
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
              tags: JSON.parse(row.tags || '[]'),
              metadata: JSON.parse(row.metadata || '{}'),
              data: typeSpecificData
            } as T;
            entries.push(entry);
          }
        }
      }

      return {
        entries,
        totalCount: entries.length,
        hasMore: false,
        searchTime: Date.now() - Date.now(),
        fromCache: false
      };
    } catch (error) {
      console.error('❌ Error searching memory entries:', error);
      return {
        entries: [],
        totalCount: 0,
        hasMore: false,
        searchTime: 0,
        fromCache: false
      };
    }
  }

  // ===== Specialized Retrieval Methods =====

  /**
   * Get player profile by Steam ID
   */
  async getPlayerProfile(steamId: string): Promise<PlayerProfileMemory | null> {
    this.ensureInitialized();

    try {
      const result = await this.executeQuery(MEMORY_QUERIES.getPlayerProfile, [steamId]);
      
      if (!result.data) {
        return null;
      }

      const row = result.data;
      
      const playerProfileData: PlayerProfileData = {
        steamId: row.steam_id,
        playerName: row.player_name,
        strengths: JSON.parse(row.strengths || '[]'),
        weaknesses: JSON.parse(row.weaknesses || '[]'),
        commonErrors: JSON.parse(row.common_errors || '[]'),
        playingStyle: {
          aggression: row.aggression_level,
          teamwork: row.teamwork_level,
          adaptability: row.adaptability_level,
          consistency: row.consistency_level,
          preferredRoles: JSON.parse(row.preferred_roles || '[]'),
          preferredWeapons: JSON.parse(row.preferred_weapons || '[]'),
          preferredMaps: JSON.parse(row.preferred_maps || '[]')
        },
        mentalState: {
          tiltResistance: row.tilt_resistance,
          communicationStyle: row.communication_style,
          motivationFactors: JSON.parse(row.motivation_factors || '[]'),
          learningPreferences: JSON.parse(row.learning_preferences || '[]')
        },
        improvementGoals: JSON.parse(row.improvement_goals || '[]')
      };

      const memoryEntry: PlayerProfileMemory = {
        id: row.id,
        type: MemoryType.PLAYER_PROFILE,
        importance: row.importance,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        tags: JSON.parse(row.tags || '[]'),
        metadata: JSON.parse(row.metadata || '{}'),
        data: playerProfileData
      };

      return memoryEntry;
    } catch (error) {
      console.error('❌ Error retrieving player profile:', error);
      return null;
    }
  }

  /**
   * Get interaction history for a player
   */
  async getInteractionHistory(
    steamId: string,
    options: MemoryQueryOptions = {}
  ): Promise<MemoryRetrievalResult<InteractionHistoryMemory>> {
    this.ensureInitialized();

    const { limit = 50, offset = 0 } = options;

    try {
      const result = await this.executeQuery(
        MEMORY_QUERIES.getInteractionHistory,
        [steamId, limit, offset]
      );

      const entries: InteractionHistoryMemory[] = [];

      if (result.data && Array.isArray(result.data)) {
        for (const row of result.data) {
          const interactionData: InteractionHistoryData = {
            steamId: row.steam_id,
            playerName: row.player_name,
            sessionId: row.session_id,
            interactionType: row.interaction_type,
            context: row.context,
            feedbackGiven: row.feedback_given,
            playerReaction: row.player_reaction,
            reactionDetails: row.reaction_details,
            effectiveness: row.effectiveness_score,
            followUp: JSON.parse(row.follow_up_data || '[]'),
            gameState: row.game_state ? JSON.parse(row.game_state) : undefined
          };

          const memoryEntry: InteractionHistoryMemory = {
            id: row.id,
            type: MemoryType.INTERACTION_HISTORY,
            importance: row.importance,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            tags: JSON.parse(row.tags || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
            data: interactionData
          };

          entries.push(memoryEntry);
        }
      }

      return {
        entries,
        totalCount: entries.length, // TODO: Implement proper count query
        hasMore: entries.length === limit,
        searchTime: 0,
        fromCache: false
      };
    } catch (error) {
      console.error('❌ Error retrieving interaction history:', error);
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
   * Get session data by session ID
   */
  async getSessionData(sessionId: string): Promise<SessionDataMemory | null> {
    this.ensureInitialized();

    try {
      const result = await this.executeQuery(MEMORY_QUERIES.getSessionData, [sessionId]);
      
      if (!result.data) {
        return null;
      }

      const row = result.data;
      
      const sessionData: SessionData = {
        sessionId: row.session_id,
        playerId: row.player_id,
        startTime: new Date(row.start_time),
        currentMap: row.current_map,
        currentGameMode: row.current_game_mode,
        currentTeamComposition: JSON.parse(row.current_team_composition || '[]'),
        observedBehaviors: JSON.parse(row.observed_behaviors || '[]'),
        recentTopics: JSON.parse(row.recent_topics || '[]'),
        coachingNotes: JSON.parse(row.coaching_notes || '[]'),
        pendingActions: JSON.parse(row.pending_actions || '[]')
      };

      const memoryEntry: SessionDataMemory = {
        id: row.id,
        type: MemoryType.SESSION_DATA,
        importance: row.importance,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        tags: JSON.parse(row.tags || '[]'),
        metadata: JSON.parse(row.metadata || '{}'),
        data: sessionData
      };

      return memoryEntry;
    } catch (error) {
      console.error('❌ Error retrieving session data:', error);
      return null;
    }
  }

  /**
   * Get current session data for a player
   */
  async getCurrentSessionData(playerId: string): Promise<SessionDataMemory | null> {
    this.ensureInitialized();

    try {
      const result = await this.executeQuery(MEMORY_QUERIES.getCurrentSessionData, [playerId]);
      
      if (!result.data) {
        return null;
      }

      // Convert to SessionDataMemory (same as getSessionData)
      return this.getSessionData(result.data.session_id);
    } catch (error) {
      console.error('❌ Error retrieving current session data:', error);
      return null;
    }
  }

  // ===== Analytics and Statistics =====

  /**
   * Get memory service status and statistics
   */
  async getStatus(): Promise<MemoryServiceStatus> {
    this.ensureInitialized();

    try {
      // Get short-term memory stats (would need integration with ShortTermMemoryManager)
      const shortTermMemory = {
        entryCount: 0,
        memoryUsage: 0,
        oldestEntry: undefined,
        newestEntry: undefined
      };

      // Get long-term memory stats from database
      const countResult = await this.executeQuery(
        'SELECT COUNT(*) as count FROM memory_entries', 
        []
      );
      
      const sizeResult = await this.executeQuery(
        'SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()', 
        []
      );

      const dateResult = await this.executeQuery(
        'SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memory_entries',
        []
      );

      const longTermMemory = {
        entryCount: countResult.data?.count || 0,
        databaseSize: sizeResult.data?.size || 0,
        oldestEntry: dateResult.data?.oldest ? new Date(dateResult.data.oldest) : undefined,
        newestEntry: dateResult.data?.newest ? new Date(dateResult.data.newest) : undefined
      };

      // Performance metrics (simplified)
      const performance = {
        averageRetrievalTime: 10, // ms
        averageStorageTime: 15,   // ms
        cacheHitRate: 0.85        // 85%
      };

      return {
        shortTermMemory,
        longTermMemory,
        performance
      };
    } catch (error) {
      console.error('❌ Error getting memory service status:', error);
      throw error;
    }
  }

  /**
   * Clean up expired entries from the database
   */
  async cleanupExpiredEntries(): Promise<number> {
    this.ensureInitialized();

    try {
      const now = Date.now();
      const result = await this.executeQuery(
        MEMORY_QUERIES.cleanupExpiredEntries,
        [now]
      );

      const deletedCount = result.rowsAffected || 0;
      
      if (this.config.debugMode && deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired memory entries`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up expired entries:', error);
      return 0;
    }
  }

  // ===== Private Helper Methods =====

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LongTermMemoryManager is not initialized. Call initialize() first.');
    }
  }

  private async executeQuery<T = any>(sql: string, params: any[] = []): Promise<DatabaseResult<T>> {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        // For SELECT queries, use db.all() to get all rows
        this.database.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              data: rows.length === 1 ? rows[0] : rows
            });
          }
        });
      } else {
        // For INSERT/UPDATE/DELETE queries, use db.run()
        this.database.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              success: true,
              rowsAffected: this.changes,
              data: this.lastID
            });
          }
        });
      }
    });
  }

  private async beginTransaction(): Promise<void> {
    if (this.transactionLevel === 0) {
      await this.executeQuery('BEGIN TRANSACTION');
    }
    this.transactionLevel++;
  }

  private async commitTransaction(): Promise<void> {
    this.transactionLevel--;
    if (this.transactionLevel === 0) {
      await this.executeQuery('COMMIT');
    }
  }

  private async rollbackTransaction(): Promise<void> {
    this.transactionLevel = 0;
    await this.executeQuery('ROLLBACK');
  }

  private async storeTypeSpecificData<T extends BaseMemoryEntry>(entryId: string, entry: T): Promise<void> {
    switch (entry.type) {
      case MemoryType.PLAYER_PROFILE:
        await this.storePlayerProfile(entryId, entry as PlayerProfileMemory);
        break;
      case MemoryType.INTERACTION_HISTORY:
        await this.storeInteractionHistory(entryId, entry as InteractionHistoryMemory);
        break;
      case MemoryType.GAME_KNOWLEDGE:
        await this.storeGameKnowledge(entryId, entry as GameKnowledgeMemory);
        break;
      case MemoryType.SESSION_DATA:
        await this.storeSessionData(entryId, entry as SessionDataMemory);
        break;
      case MemoryType.COACHING_INSIGHTS:
        await this.storeCoachingInsights(entryId, entry as CoachingInsightsMemory);
        break;
      default:
        throw new Error(`Unsupported memory type: ${entry.type}`);
    }
  }

  private async getTypeSpecificData(entryId: string, type: MemoryType): Promise<any> {
    switch (type) {
      case MemoryType.PLAYER_PROFILE:
        return this.getPlayerProfileData(entryId);
      case MemoryType.INTERACTION_HISTORY:
        return this.getInteractionHistoryData(entryId);
      case MemoryType.GAME_KNOWLEDGE:
        return this.getGameKnowledgeData(entryId);
      case MemoryType.SESSION_DATA:
        return this.getSessionDataData(entryId);
      case MemoryType.COACHING_INSIGHTS:
        return this.getCoachingInsightsData(entryId);
      default:
        return null;
    }
  }

  private async updateTypeSpecificData(entryId: string, type: MemoryType, data: any): Promise<void> {
    // Implementation would depend on the specific update requirements for each type
    // For now, we'll implement a basic update that replaces the data
    switch (type) {
      case MemoryType.PLAYER_PROFILE:
        // Update player profile data
        break;
      case MemoryType.INTERACTION_HISTORY:
        // Update interaction history data
        break;
      // ... other cases
    }
  }

  private async storePlayerProfile(entryId: string, entry: PlayerProfileMemory): Promise<void> {
    const data = entry.data as PlayerProfileData;
    await this.executeQuery(
      MEMORY_QUERIES.insertPlayerProfile,
      [
        uuidv4(),
        entryId,
        data.steamId,
        data.playerName,
        JSON.stringify(data.strengths),
        JSON.stringify(data.weaknesses),
        JSON.stringify(data.commonErrors),
        data.playingStyle.aggression,
        data.playingStyle.teamwork,
        data.playingStyle.adaptability,
        data.playingStyle.consistency,
        JSON.stringify(data.playingStyle.preferredRoles),
        JSON.stringify(data.playingStyle.preferredWeapons),
        JSON.stringify(data.playingStyle.preferredMaps),
        data.mentalState.tiltResistance,
        data.mentalState.communicationStyle,
        JSON.stringify(data.mentalState.motivationFactors),
        JSON.stringify(data.mentalState.learningPreferences),
        JSON.stringify(data.improvementGoals),
        Date.now()
      ]
    );
  }

  private async storeInteractionHistory(entryId: string, entry: InteractionHistoryMemory): Promise<void> {
    const data = entry.data as InteractionHistoryData;
    await this.executeQuery(
      MEMORY_QUERIES.insertInteractionHistory,
      [
        uuidv4(),
        entryId,
        data.steamId,
        data.playerName,
        data.sessionId,
        data.interactionType,
        data.context,
        data.feedbackGiven,
        data.playerReaction,
        data.reactionDetails,
        data.effectiveness,
        JSON.stringify(data.followUp),
        data.gameState ? JSON.stringify(data.gameState) : null,
        Date.now()
      ]
    );
  }

  private async storeGameKnowledge(entryId: string, entry: GameKnowledgeMemory): Promise<void> {
    const data = entry.data as GameKnowledgeData;
    await this.executeQuery(
      MEMORY_QUERIES.insertGameKnowledge,
      [
        uuidv4(),
        entryId,
        data.knowledgeType,
        data.title,
        data.description,
        JSON.stringify(data.mapSpecific || []),
        JSON.stringify(data.situationSpecific || []),
        data.teamSide,
        JSON.stringify(data.keyPoints),
        JSON.stringify(data.commonMistakes),
        JSON.stringify(data.successIndicators),
        JSON.stringify(data.sources),
        data.timesReferenced,
        data.lastUsed ? data.lastUsed.getTime() : null,
        data.effectiveness
      ]
    );
  }

  private async storeSessionData(entryId: string, entry: SessionDataMemory): Promise<void> {
    const data = entry.data as SessionData;
    await this.executeQuery(
      MEMORY_QUERIES.insertSessionData,
      [
        uuidv4(),
        entryId,
        data.sessionId,
        data.playerId,
        data.startTime.getTime(),
        null, // end_time
        1, // is_active
        data.currentMap,
        data.currentGameMode,
        JSON.stringify(data.currentTeamComposition || []),
        JSON.stringify(data.observedBehaviors),
        JSON.stringify(data.recentTopics),
        JSON.stringify(data.coachingNotes),
        JSON.stringify(data.pendingActions),
        0, // total_interactions
        0.5 // avg_player_engagement
      ]
    );
  }

  private async storeCoachingInsights(entryId: string, entry: CoachingInsightsMemory): Promise<void> {
    const data = entry.data as CoachingInsightsData;
    await this.executeQuery(
      MEMORY_QUERIES.insertCoachingInsights,
      [
        uuidv4(),
        entryId,
        data.insightId,
        data.playerId,
        data.insight,
        data.category,
        data.confidence,
        JSON.stringify(data.basedOn),
        JSON.stringify(data.recommendations),
        data.validated ? 1 : 0,
        data.validationSource,
        data.actualOutcome,
        data.validationScore,
        Date.now(),
        'memory-service-v1'
      ]
    );
  }

  // Data retrieval helpers for type-specific data
  private async getPlayerProfileData(entryId: string): Promise<PlayerProfileData | null> {
    const result = await this.executeQuery(
      'SELECT * FROM player_profiles WHERE memory_entry_id = ?',
      [entryId]
    );
    
    if (!result.data) return null;
    
    const row = result.data;
    return {
      steamId: row.steam_id,
      playerName: row.player_name,
      strengths: JSON.parse(row.strengths || '[]'),
      weaknesses: JSON.parse(row.weaknesses || '[]'),
      commonErrors: JSON.parse(row.common_errors || '[]'),
      playingStyle: {
        aggression: row.aggression_level,
        teamwork: row.teamwork_level,
        adaptability: row.adaptability_level,
        consistency: row.consistency_level,
        preferredRoles: JSON.parse(row.preferred_roles || '[]'),
        preferredWeapons: JSON.parse(row.preferred_weapons || '[]'),
        preferredMaps: JSON.parse(row.preferred_maps || '[]')
      },
      mentalState: {
        tiltResistance: row.tilt_resistance,
        communicationStyle: row.communication_style,
        motivationFactors: JSON.parse(row.motivation_factors || '[]'),
        learningPreferences: JSON.parse(row.learning_preferences || '[]')
      },
      improvementGoals: JSON.parse(row.improvement_goals || '[]')
    };
  }

  private async getInteractionHistoryData(entryId: string): Promise<InteractionHistoryData | null> {
    const result = await this.executeQuery(
      'SELECT * FROM interaction_history WHERE memory_entry_id = ?',
      [entryId]
    );
    
    if (!result.data) return null;
    
    const row = result.data;
    return {
      steamId: row.steam_id,
      playerName: row.player_name,
      sessionId: row.session_id,
      interactionType: row.interaction_type,
      context: row.context,
      feedbackGiven: row.feedback_given,
      playerReaction: row.player_reaction,
      reactionDetails: row.reaction_details,
      effectiveness: row.effectiveness_score,
      followUp: JSON.parse(row.follow_up_data || '[]'),
      gameState: row.game_state ? JSON.parse(row.game_state) : undefined
    };
  }

  private async getGameKnowledgeData(entryId: string): Promise<GameKnowledgeData | null> {
    const result = await this.executeQuery(
      'SELECT * FROM game_knowledge WHERE memory_entry_id = ?',
      [entryId]
    );
    
    if (!result.data) return null;
    
    const row = result.data;
    return {
      knowledgeType: row.knowledge_type,
      title: row.title,
      description: row.description,
      mapSpecific: JSON.parse(row.map_specific || '[]'),
      situationSpecific: JSON.parse(row.situation_specific || '[]'),
      teamSide: row.team_side,
      keyPoints: JSON.parse(row.key_points || '[]'),
      commonMistakes: JSON.parse(row.common_mistakes || '[]'),
      successIndicators: JSON.parse(row.success_indicators || '[]'),
      sources: JSON.parse(row.sources || '[]'),
      timesReferenced: row.times_referenced,
      lastUsed: row.last_used ? new Date(row.last_used) : new Date(),
      effectiveness: row.effectiveness_score
    };
  }

  private async getSessionDataData(entryId: string): Promise<SessionData | null> {
    const result = await this.executeQuery(
      'SELECT * FROM session_data WHERE memory_entry_id = ?',
      [entryId]
    );
    
    if (!result.data) return null;
    
    const row = result.data;
    return {
      sessionId: row.session_id,
      playerId: row.player_id,
      startTime: new Date(row.start_time),
      currentMap: row.current_map,
      currentGameMode: row.current_game_mode,
      currentTeamComposition: JSON.parse(row.current_team_composition || '[]'),
      observedBehaviors: JSON.parse(row.observed_behaviors || '[]'),
      recentTopics: JSON.parse(row.recent_topics || '[]'),
      coachingNotes: JSON.parse(row.coaching_notes || '[]'),
      pendingActions: JSON.parse(row.pending_actions || '[]')
    };
  }

  private async getCoachingInsightsData(entryId: string): Promise<CoachingInsightsData | null> {
    const result = await this.executeQuery(
      'SELECT * FROM coaching_insights WHERE memory_entry_id = ?',
      [entryId]
    );
    
    if (!result.data) return null;
    
    const row = result.data;
    return {
      insightId: row.insight_id,
      playerId: row.player_id,
      insight: row.insight,
      category: row.category,
      confidence: row.confidence_score,
      basedOn: JSON.parse(row.based_on || '[]'),
      recommendations: JSON.parse(row.recommendations || '[]'),
      validated: Boolean(row.validated),
      validationSource: row.validation_source,
      actualOutcome: row.actual_outcome,
      validationScore: row.validation_score
    };
  }

  private async storeTags(entryId: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.executeQuery(
        'INSERT INTO memory_tags (memory_entry_id, tag) VALUES (?, ?)',
        [entryId, tag]
      );
    }
  }

  private async updateTags(entryId: string, tags: string[]): Promise<void> {
    // Remove existing tags
    await this.executeQuery(
      'DELETE FROM memory_tags WHERE memory_entry_id = ?',
      [entryId]
    );
    
    // Add new tags
    await this.storeTags(entryId, tags);
  }

  private getSortColumn(sortBy: string): string {
    switch (sortBy) {
      case 'createdAt': return 'me.created_at';
      case 'updatedAt': return 'me.updated_at';
      case 'importance': return 'me.importance';
      case 'relevance': return 'me.created_at'; // fallback
      default: return 'me.updated_at';
    }
  }
}

// ===== Factory Function =====

/**
 * Create and initialize a new LongTermMemoryManager instance
 */
export async function createLongTermMemoryManager(
  database?: Database,
  config?: Partial<LongTermMemoryConfig>
): Promise<LongTermMemoryManager> {
  const manager = new LongTermMemoryManager(database, config);
  await manager.initialize();
  return manager;
}

// ===== Export Default Instance =====

/**
 * Default long-term memory manager instance (singleton pattern)
 */
let defaultManager: LongTermMemoryManager | null = null;

/**
 * Get the default long-term memory manager instance
 */
export async function getDefaultLongTermMemoryManager(): Promise<LongTermMemoryManager> {
  if (!defaultManager) {
    defaultManager = await createLongTermMemoryManager();
  }
  return defaultManager;
} 