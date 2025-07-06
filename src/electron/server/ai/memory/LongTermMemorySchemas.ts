/**
 * Long-Term Memory (SQLite) Schemas and Database Structure
 * 
 * This file defines the SQLite database schemas for persistent storage
 * of player profiles, interaction history, game knowledge, and coaching insights.
 * Optimized for complex queries and historical data analysis.
 */

import { Database } from 'sqlite3';
import { MemoryType, MemoryImportance } from '../interfaces/MemoryService.js';

// ===== Database Schema Definitions =====

/**
 * SQL DDL statements for creating all memory-related tables
 */
export const MEMORY_TABLES_DDL = {
  
  /**
   * Main memory entries table - stores all memory entries with metadata
   */
  memory_entries: `
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('player_profile', 'interaction_history', 'game_knowledge', 'session_data', 'coaching_insights')),
      importance TEXT NOT NULL CHECK (importance IN ('critical', 'high', 'medium', 'low', 'temporary')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      
      -- Index for common query patterns
      UNIQUE(id)
    )
  `,

  /**
   * Player profiles table - detailed player information and analytics
   */
  player_profiles: `
    CREATE TABLE IF NOT EXISTS player_profiles (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL,
      steam_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      
      -- Performance data (JSON serialized)
      strengths TEXT NOT NULL DEFAULT '[]',
      weaknesses TEXT NOT NULL DEFAULT '[]',
      common_errors TEXT NOT NULL DEFAULT '[]',
      
      -- Playing style metrics
      aggression_level REAL DEFAULT 0.5 CHECK (aggression_level >= 0 AND aggression_level <= 1),
      teamwork_level REAL DEFAULT 0.5 CHECK (teamwork_level >= 0 AND teamwork_level <= 1),
      adaptability_level REAL DEFAULT 0.5 CHECK (adaptability_level >= 0 AND adaptability_level <= 1),
      consistency_level REAL DEFAULT 0.5 CHECK (consistency_level >= 0 AND consistency_level <= 1),
      preferred_roles TEXT NOT NULL DEFAULT '[]',
      preferred_weapons TEXT NOT NULL DEFAULT '[]',
      preferred_maps TEXT NOT NULL DEFAULT '[]',
      
      -- Psychological profile
      tilt_resistance REAL DEFAULT 0.5 CHECK (tilt_resistance >= 0 AND tilt_resistance <= 1),
      communication_style TEXT DEFAULT 'neutral',
      motivation_factors TEXT NOT NULL DEFAULT '[]',
      learning_preferences TEXT NOT NULL DEFAULT '[]',
      
      -- Progress tracking
      improvement_goals TEXT NOT NULL DEFAULT '[]',
      
      -- Performance optimization
      last_updated INTEGER NOT NULL,
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      UNIQUE(steam_id),
      INDEX idx_player_profiles_steam_id (steam_id),
      INDEX idx_player_profiles_last_updated (last_updated)
    )
  `,

  /**
   * Interaction history table - coaching sessions and player interactions
   */
  interaction_history: `
    CREATE TABLE IF NOT EXISTS interaction_history (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL,
      steam_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      session_id TEXT NOT NULL,
      
      -- Interaction details
      interaction_type TEXT NOT NULL CHECK (interaction_type IN ('coaching_feedback', 'strategy_discussion', 'performance_analysis', 'mental_coaching', 'technical_guidance', 'team_coordination')),
      context TEXT NOT NULL,
      feedback_given TEXT NOT NULL,
      player_reaction TEXT NOT NULL CHECK (player_reaction IN ('positive', 'neutral', 'resistant', 'confused', 'engaged', 'defensive')),
      reaction_details TEXT NOT NULL,
      
      -- Effectiveness tracking
      effectiveness_score REAL NOT NULL CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
      follow_up_data TEXT NOT NULL DEFAULT '[]',
      
      -- Game state context (JSON serialized)
      game_state TEXT NULL,
      
      -- Timestamps
      interaction_time INTEGER NOT NULL,
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      INDEX idx_interaction_history_steam_id (steam_id),
      INDEX idx_interaction_history_session_id (session_id),
      INDEX idx_interaction_history_time (interaction_time),
      INDEX idx_interaction_history_type (interaction_type),
      INDEX idx_interaction_history_effectiveness (effectiveness_score)
    )
  `,

  /**
   * Game knowledge table - strategic and tactical knowledge base
   */
  game_knowledge: `
    CREATE TABLE IF NOT EXISTS game_knowledge (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL,
      knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('map_layout', 'strategy', 'tactic', 'economy', 'utility_usage', 'positioning', 'timing')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      
      -- Contextual information
      map_specific TEXT NULL DEFAULT '[]',
      situation_specific TEXT NULL DEFAULT '[]',
      team_side TEXT NULL CHECK (team_side IN ('T', 'CT', 'both') OR team_side IS NULL),
      
      -- Content details (JSON serialized)
      key_points TEXT NOT NULL DEFAULT '[]',
      common_mistakes TEXT NOT NULL DEFAULT '[]',
      success_indicators TEXT NOT NULL DEFAULT '[]',
      
      -- Supporting evidence
      sources TEXT NOT NULL DEFAULT '[]',
      
      -- Usage tracking
      times_referenced INTEGER NOT NULL DEFAULT 0,
      last_used INTEGER NULL,
      effectiveness_score REAL NOT NULL DEFAULT 0.5 CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      INDEX idx_game_knowledge_type (knowledge_type),
      INDEX idx_game_knowledge_effectiveness (effectiveness_score),
      INDEX idx_game_knowledge_usage (times_referenced),
      INDEX idx_game_knowledge_last_used (last_used)
    )
  `,

  /**
   * Session data table - gaming session information
   */
  session_data: `
    CREATE TABLE IF NOT EXISTS session_data (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NULL,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      
      -- Current context
      current_map TEXT NULL,
      current_game_mode TEXT NULL,
      current_team_composition TEXT NULL DEFAULT '[]',
      
      -- Session insights (JSON serialized)
      observed_behaviors TEXT NOT NULL DEFAULT '[]',
      recent_topics TEXT NOT NULL DEFAULT '[]',
      coaching_notes TEXT NOT NULL DEFAULT '[]',
      pending_actions TEXT NOT NULL DEFAULT '[]',
      
      -- Session metrics
      total_interactions INTEGER NOT NULL DEFAULT 0,
      avg_player_engagement REAL DEFAULT 0.5 CHECK (avg_player_engagement >= 0 AND avg_player_engagement <= 1),
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      UNIQUE(session_id),
      INDEX idx_session_data_player_id (player_id),
      INDEX idx_session_data_start_time (start_time),
      INDEX idx_session_data_active (is_active)
    )
  `,

  /**
   * Coaching insights table - AI-generated insights and recommendations
   */
  coaching_insights: `
    CREATE TABLE IF NOT EXISTS coaching_insights (
      id TEXT PRIMARY KEY,
      memory_entry_id TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      
      -- Insight details
      insight TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      
      -- Supporting data (JSON serialized)
      based_on TEXT NOT NULL DEFAULT '[]',
      recommendations TEXT NOT NULL DEFAULT '[]',
      
      -- Validation tracking
      validated BOOLEAN NOT NULL DEFAULT 0,
      validation_source TEXT NULL,
      actual_outcome TEXT NULL,
      validation_score REAL NULL CHECK (validation_score >= 0 AND validation_score <= 1 OR validation_score IS NULL),
      
      -- Generation metadata
      generated_at INTEGER NOT NULL,
      ai_model_version TEXT NULL,
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      UNIQUE(insight_id),
      INDEX idx_coaching_insights_player_id (player_id),
      INDEX idx_coaching_insights_category (category),
      INDEX idx_coaching_insights_confidence (confidence_score),
      INDEX idx_coaching_insights_validated (validated),
      INDEX idx_coaching_insights_generated_at (generated_at)
    )
  `,

  /**
   * Memory tags table - for flexible tagging and categorization
   */
  memory_tags: `
    CREATE TABLE IF NOT EXISTS memory_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_entry_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      UNIQUE(memory_entry_id, tag),
      INDEX idx_memory_tags_tag (tag),
      INDEX idx_memory_tags_memory_id (memory_entry_id)
    )
  `,

  /**
   * Memory relationships table - for linking related memories
   */
  memory_relationships: `
    CREATE TABLE IF NOT EXISTS memory_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_memory_id TEXT NOT NULL,
      target_memory_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL CHECK (relationship_type IN ('references', 'supports', 'contradicts', 'evolves_from', 'similar_to')),
      strength REAL NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
      created_at INTEGER NOT NULL,
      
      FOREIGN KEY (source_memory_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (target_memory_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      UNIQUE(source_memory_id, target_memory_id, relationship_type),
      INDEX idx_memory_relationships_source (source_memory_id),
      INDEX idx_memory_relationships_target (target_memory_id),
      INDEX idx_memory_relationships_type (relationship_type),
      INDEX idx_memory_relationships_strength (strength)
    )
  `,

  /**
   * Memory access log table - for analytics and optimization
   */
  memory_access_log: `
    CREATE TABLE IF NOT EXISTS memory_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_entry_id TEXT NOT NULL,
      access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'delete', 'search')),
      access_context TEXT NULL,
      user_context TEXT NULL,
      response_time_ms INTEGER NULL,
      cache_hit BOOLEAN NULL,
      accessed_at INTEGER NOT NULL,
      
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE,
      INDEX idx_memory_access_log_memory_id (memory_entry_id),
      INDEX idx_memory_access_log_type (access_type),
      INDEX idx_memory_access_log_time (accessed_at),
      INDEX idx_memory_access_log_performance (response_time_ms)
    )
  `,

  /**
   * Memory statistics table - for performance monitoring
   */
  memory_statistics: `
    CREATE TABLE IF NOT EXISTS memory_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_type TEXT NOT NULL,
      stat_key TEXT NOT NULL,
      stat_value REAL NOT NULL,
      recorded_at INTEGER NOT NULL,
      context TEXT NULL,
      
      UNIQUE(stat_type, stat_key, recorded_at),
      INDEX idx_memory_statistics_type (stat_type),
      INDEX idx_memory_statistics_key (stat_key),
      INDEX idx_memory_statistics_time (recorded_at)
    )
  `
};

// ===== Database Indexes for Optimization =====

/**
 * Additional indexes for complex queries and performance optimization
 */
export const MEMORY_INDEXES_DDL = [
  // Composite indexes for common query patterns
  'CREATE INDEX IF NOT EXISTS idx_memory_entries_type_importance ON memory_entries(type, importance)',
  'CREATE INDEX IF NOT EXISTS idx_memory_entries_type_created ON memory_entries(type, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_memory_entries_importance_updated ON memory_entries(importance, updated_at)',
  
  // Player-centric indexes
  'CREATE INDEX IF NOT EXISTS idx_player_profiles_performance ON player_profiles(steam_id, last_updated)',
  'CREATE INDEX IF NOT EXISTS idx_interaction_effectiveness ON interaction_history(steam_id, effectiveness_score, interaction_time)',
  
  // Session and contextual indexes
  'CREATE INDEX IF NOT EXISTS idx_session_context ON session_data(player_id, is_active, start_time)',
  'CREATE INDEX IF NOT EXISTS idx_game_knowledge_context ON game_knowledge(knowledge_type, effectiveness_score, times_referenced)',
  
  // Insight and analytics indexes
  'CREATE INDEX IF NOT EXISTS idx_coaching_insights_performance ON coaching_insights(player_id, confidence_score, generated_at)',
  'CREATE INDEX IF NOT EXISTS idx_memory_access_analytics ON memory_access_log(access_type, accessed_at, response_time_ms)',
  
  // Full-text search preparation (if needed)
  'CREATE INDEX IF NOT EXISTS idx_player_profiles_search ON player_profiles(player_name, steam_id)',
  'CREATE INDEX IF NOT EXISTS idx_game_knowledge_search ON game_knowledge(title, knowledge_type)',
  'CREATE INDEX IF NOT EXISTS idx_coaching_insights_search ON coaching_insights(category, insight)'
];

// ===== Database Views for Complex Queries =====

/**
 * Pre-defined views for common analytical queries
 */
export const MEMORY_VIEWS_DDL = {
  
  /**
   * Player summary view - comprehensive player information
   */
  player_summary: `
    CREATE VIEW IF NOT EXISTS player_summary AS
    SELECT 
      pp.steam_id,
      pp.player_name,
      pp.aggression_level,
      pp.teamwork_level,
      pp.adaptability_level,
      pp.consistency_level,
      pp.tilt_resistance,
      COUNT(ih.id) as total_interactions,
      AVG(ih.effectiveness_score) as avg_coaching_effectiveness,
      COUNT(ci.id) as total_insights,
      AVG(ci.confidence_score) as avg_insight_confidence,
      MAX(ih.interaction_time) as last_interaction,
      pp.last_updated as profile_last_updated
    FROM player_profiles pp
    LEFT JOIN interaction_history ih ON pp.steam_id = ih.steam_id
    LEFT JOIN coaching_insights ci ON pp.steam_id = ci.player_id
    GROUP BY pp.steam_id, pp.player_name
  `,

  /**
   * Session analytics view - session performance metrics
   */
  session_analytics: `
    CREATE VIEW IF NOT EXISTS session_analytics AS
    SELECT 
      sd.session_id,
      sd.player_id,
      sd.start_time,
      sd.end_time,
      sd.total_interactions,
      sd.avg_player_engagement,
      COUNT(ih.id) as coaching_interactions,
      AVG(ih.effectiveness_score) as session_coaching_effectiveness,
      COUNT(ci.id) as insights_generated,
      AVG(ci.confidence_score) as avg_insight_confidence
    FROM session_data sd
    LEFT JOIN interaction_history ih ON sd.session_id = ih.session_id
    LEFT JOIN coaching_insights ci ON sd.player_id = ci.player_id 
      AND ci.generated_at BETWEEN sd.start_time AND COALESCE(sd.end_time, strftime('%s', 'now') * 1000)
    GROUP BY sd.session_id
  `,

  /**
   * Knowledge effectiveness view - game knowledge performance
   */
  knowledge_effectiveness: `
    CREATE VIEW IF NOT EXISTS knowledge_effectiveness AS
    SELECT 
      gk.knowledge_type,
      gk.title,
      gk.times_referenced,
      gk.effectiveness_score,
      gk.last_used,
      COUNT(mr.id) as related_memories,
      AVG(mr.strength) as avg_relationship_strength
    FROM game_knowledge gk
    LEFT JOIN memory_relationships mr ON gk.memory_entry_id = mr.source_memory_id
    GROUP BY gk.id
    ORDER BY gk.effectiveness_score DESC, gk.times_referenced DESC
  `
};

// ===== Database Triggers for Data Integrity =====

/**
 * Database triggers for maintaining data consistency and audit trails
 */
export const MEMORY_TRIGGERS_DDL = [
  
  /**
   * Trigger to update memory_entries.updated_at when child tables are modified
   */
  `CREATE TRIGGER IF NOT EXISTS update_memory_entry_timestamp_player_profiles
   AFTER UPDATE ON player_profiles
   BEGIN
     UPDATE memory_entries 
     SET updated_at = strftime('%s', 'now') * 1000 
     WHERE id = NEW.memory_entry_id;
   END`,

  `CREATE TRIGGER IF NOT EXISTS update_memory_entry_timestamp_interaction_history
   AFTER INSERT ON interaction_history
   BEGIN
     UPDATE memory_entries 
     SET updated_at = strftime('%s', 'now') * 1000 
     WHERE id = NEW.memory_entry_id;
   END`,

  `CREATE TRIGGER IF NOT EXISTS update_memory_entry_timestamp_game_knowledge
   AFTER UPDATE ON game_knowledge
   BEGIN
     UPDATE memory_entries 
     SET updated_at = strftime('%s', 'now') * 1000 
     WHERE id = NEW.memory_entry_id;
   END`,

  `CREATE TRIGGER IF NOT EXISTS update_memory_entry_timestamp_coaching_insights
   AFTER INSERT ON coaching_insights
   BEGIN
     UPDATE memory_entries 
     SET updated_at = strftime('%s', 'now') * 1000 
     WHERE id = NEW.memory_entry_id;
   END`,

  /**
   * Trigger to log memory access for analytics
   */
  `CREATE TRIGGER IF NOT EXISTS log_memory_access_read
   AFTER UPDATE ON memory_entries
   WHEN OLD.updated_at != NEW.updated_at
   BEGIN
     INSERT INTO memory_access_log (memory_entry_id, access_type, accessed_at)
     VALUES (NEW.id, 'read', strftime('%s', 'now') * 1000);
   END`,

  /**
   * Trigger to clean up expired entries
   */
  `CREATE TRIGGER IF NOT EXISTS cleanup_expired_entries
   AFTER INSERT ON memory_entries
   WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < strftime('%s', 'now') * 1000
   BEGIN
     DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at < strftime('%s', 'now') * 1000;
   END`
];

// ===== Database Schema Initialization Function =====

/**
 * Initialize all memory-related database tables, indexes, views, and triggers
 */
export async function initializeMemorySchema(database: Database): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    console.log('🗄️ Initializing Memory Service database schema...');
    
    const operations: Promise<void>[] = [];
    
    // Create tables
    Object.entries(MEMORY_TABLES_DDL).forEach(([tableName, ddl]) => {
      operations.push(new Promise<void>((resolveTable, rejectTable) => {
        database.run(ddl, (err) => {
          if (err) {
            console.error(`Error creating table ${tableName}:`, err.message);
            rejectTable(err);
          } else {
            console.log(`✅ Created table: ${tableName}`);
            resolveTable();
          }
        });
      }));
    });
    
    // Create indexes
    MEMORY_INDEXES_DDL.forEach((indexDdl, index) => {
      operations.push(new Promise<void>((resolveIndex, rejectIndex) => {
        database.run(indexDdl, (err) => {
          if (err) {
            console.error(`Error creating index ${index}:`, err.message);
            rejectIndex(err);
          } else {
            console.log(`✅ Created index ${index}`);
            resolveIndex();
          }
        });
      }));
    });
    
    // Create views
    Object.entries(MEMORY_VIEWS_DDL).forEach(([viewName, ddl]) => {
      operations.push(new Promise<void>((resolveView, rejectView) => {
        database.run(ddl, (err) => {
          if (err) {
            console.error(`Error creating view ${viewName}:`, err.message);
            rejectView(err);
          } else {
            console.log(`✅ Created view: ${viewName}`);
            resolveView();
          }
        });
      }));
    });
    
    // Create triggers
    MEMORY_TRIGGERS_DDL.forEach((triggerDdl, index) => {
      operations.push(new Promise<void>((resolveTrigger, rejectTrigger) => {
        database.run(triggerDdl, (err) => {
          if (err) {
            console.error(`Error creating trigger ${index}:`, err.message);
            rejectTrigger(err);
          } else {
            console.log(`✅ Created trigger ${index}`);
            resolveTrigger();
          }
        });
      }));
    });
    
    // Execute all operations
    Promise.all(operations)
      .then(() => {
        console.log('🎉 Memory Service database schema initialized successfully!');
        resolve();
      })
      .catch((error) => {
        console.error('❌ Failed to initialize Memory Service database schema:', error);
        reject(error);
      });
  });
}

// ===== Query Helpers and Constants =====

/**
 * Common SQL queries for memory operations
 */
export const MEMORY_QUERIES = {
  
  // Basic CRUD operations
  insertMemoryEntry: `
    INSERT INTO memory_entries (id, type, importance, created_at, updated_at, expires_at, tags, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getMemoryEntry: `
    SELECT * FROM memory_entries WHERE id = ?
  `,
  
  updateMemoryEntry: `
    UPDATE memory_entries 
    SET type = ?, importance = ?, updated_at = ?, expires_at = ?, tags = ?, metadata = ?
    WHERE id = ?
  `,
  
  deleteMemoryEntry: `
    DELETE FROM memory_entries WHERE id = ?
  `,
  
  // Player profile operations
  insertPlayerProfile: `
    INSERT INTO player_profiles (
      id, memory_entry_id, steam_id, player_name, strengths, weaknesses, common_errors,
      aggression_level, teamwork_level, adaptability_level, consistency_level,
      preferred_roles, preferred_weapons, preferred_maps, tilt_resistance,
      communication_style, motivation_factors, learning_preferences, improvement_goals, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getPlayerProfile: `
    SELECT pp.*, me.* FROM player_profiles pp
    JOIN memory_entries me ON pp.memory_entry_id = me.id
    WHERE pp.steam_id = ?
  `,
  
  // Interaction history operations
  insertInteractionHistory: `
    INSERT INTO interaction_history (
      id, memory_entry_id, steam_id, player_name, session_id, interaction_type,
      context, feedback_given, player_reaction, reaction_details, effectiveness_score,
      follow_up_data, game_state, interaction_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getInteractionHistory: `
    SELECT ih.*, me.* FROM interaction_history ih
    JOIN memory_entries me ON ih.memory_entry_id = me.id
    WHERE ih.steam_id = ?
    ORDER BY ih.interaction_time DESC
    LIMIT ? OFFSET ?
  `,
  
  // Game knowledge operations
  insertGameKnowledge: `
    INSERT INTO game_knowledge (
      id, memory_entry_id, knowledge_type, title, description, map_specific,
      situation_specific, team_side, key_points, common_mistakes, success_indicators,
      sources, times_referenced, last_used, effectiveness_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getGameKnowledge: `
    SELECT gk.*, me.* FROM game_knowledge gk
    JOIN memory_entries me ON gk.memory_entry_id = me.id
    WHERE gk.knowledge_type = ? OR ? IS NULL
    ORDER BY gk.effectiveness_score DESC, gk.times_referenced DESC
    LIMIT ? OFFSET ?
  `,
  
  // Session data operations
  insertSessionData: `
    INSERT INTO session_data (
      id, memory_entry_id, session_id, player_id, start_time, end_time, is_active,
      current_map, current_game_mode, current_team_composition, observed_behaviors,
      recent_topics, coaching_notes, pending_actions, total_interactions, avg_player_engagement
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getSessionData: `
    SELECT sd.*, me.* FROM session_data sd
    JOIN memory_entries me ON sd.memory_entry_id = me.id
    WHERE sd.session_id = ?
  `,
  
  getCurrentSessionData: `
    SELECT sd.*, me.* FROM session_data sd
    JOIN memory_entries me ON sd.memory_entry_id = me.id
    WHERE sd.player_id = ? AND sd.is_active = 1
    ORDER BY sd.start_time DESC
    LIMIT 1
  `,
  
  // Coaching insights operations
  insertCoachingInsights: `
    INSERT INTO coaching_insights (
      id, memory_entry_id, insight_id, player_id, insight, category, confidence_score,
      based_on, recommendations, validated, validation_source, actual_outcome,
      validation_score, generated_at, ai_model_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  
  getCoachingInsights: `
    SELECT ci.*, me.* FROM coaching_insights ci
    JOIN memory_entries me ON ci.memory_entry_id = me.id
    WHERE ci.player_id = ?
    ORDER BY ci.generated_at DESC
    LIMIT ? OFFSET ?
  `,
  
  // Analytics and statistics queries
  getPlayerSummary: `SELECT * FROM player_summary WHERE steam_id = ?`,
  getSessionAnalytics: `SELECT * FROM session_analytics WHERE session_id = ?`,
  getKnowledgeEffectiveness: `SELECT * FROM knowledge_effectiveness ORDER BY effectiveness_score DESC LIMIT ?`,
  
  // Search and contextual queries
  searchMemoriesByTag: `
    SELECT me.*, mt.tag FROM memory_entries me
    JOIN memory_tags mt ON me.id = mt.memory_entry_id
    WHERE mt.tag IN (${Array(10).fill('?').join(',')})
    ORDER BY me.updated_at DESC
    LIMIT ? OFFSET ?
  `,
  
  getRelatedMemories: `
    SELECT me.*, mr.relationship_type, mr.strength FROM memory_entries me
    JOIN memory_relationships mr ON me.id = mr.target_memory_id
    WHERE mr.source_memory_id = ?
    ORDER BY mr.strength DESC
    LIMIT ?
  `,
  
  cleanupExpiredEntries: `
    DELETE FROM memory_entries 
    WHERE expires_at IS NOT NULL AND expires_at < ?
  `
};

/**
 * Memory type to table mapping for dynamic queries
 */
export const MEMORY_TYPE_TABLES: Record<MemoryType, string> = {
  [MemoryType.PLAYER_PROFILE]: 'player_profiles',
  [MemoryType.INTERACTION_HISTORY]: 'interaction_history',
  [MemoryType.GAME_KNOWLEDGE]: 'game_knowledge',
  [MemoryType.SESSION_DATA]: 'session_data',
  [MemoryType.COACHING_INSIGHTS]: 'coaching_insights'
};

/**
 * Default TTL values by memory importance (in milliseconds)
 */
export const DEFAULT_TTL_BY_IMPORTANCE: Record<MemoryImportance, number | null> = {
  [MemoryImportance.CRITICAL]: null,              // Never expires
  [MemoryImportance.HIGH]: 30 * 24 * 60 * 60 * 1000,    // 30 days
  [MemoryImportance.MEDIUM]: 7 * 24 * 60 * 60 * 1000,    // 7 days
  [MemoryImportance.LOW]: 24 * 60 * 60 * 1000,           // 1 day
  [MemoryImportance.TEMPORARY]: 60 * 60 * 1000            // 1 hour
}; 