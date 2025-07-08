/**
 * Memory Service Interfaces and Types
 * 
 * This file defines the comprehensive architecture for the MemoryService,
 * including data structures for short-term (in-memory) and long-term (SQLite)
 * storage of player profiles, interaction history, and game knowledge.
 */

// ===== Core Memory Types =====

/**
 * Enum for different types of memory entries
 */
export enum MemoryType {
  PLAYER_PROFILE = 'player_profile',
  INTERACTION_HISTORY = 'interaction_history',
  GAME_KNOWLEDGE = 'game_knowledge',
  SESSION_DATA = 'session_data',
  COACHING_INSIGHTS = 'coaching_insights'
}

/**
 * Enum for memory importance levels (affects retention and retrieval priority)
 */
export enum MemoryImportance {
  CRITICAL = 'critical',     // Never expires, highest priority
  HIGH = 'high',             // Long retention, high priority  
  MEDIUM = 'medium',         // Standard retention, normal priority
  LOW = 'low',               // Short retention, low priority
  TEMPORARY = 'temporary'    // Session only, lowest priority
}

export type ImportanceLevel = MemoryImportance;

/**
 * Base interface for all memory entries
 */
export interface BaseMemoryEntry {
  id: string;
  type: MemoryType;
  /**
   * Importance level influences retention & prioritization
   */
  importance: MemoryImportance;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Optional expiration timestamp; undefined = never expires
   */
  expiresAt?: Date;
  /**
   * Optional free-form textual content (used by some orchestrator helpers)
   */
  content?: string;
  /**
   * Tags for quick filtering / lookup
   */
  tags: string[];
  /**
   * Arbitrary extra metadata
   */
  metadata: Record<string, any>;
  /**
   * Generic payload. Concrete memory sub-types specialise this.
   */
  data?: unknown;
}

// ===== Player Profile Memory =====

/**
 * Player strengths and weaknesses data
 */
export interface PlayerProfileData {
  steamId: string;
  playerName: string;
  
  // Performance metrics
  strengths: Array<{
    category: string;          // e.g., "aim", "game_sense", "teamwork"
    description: string;       // Detailed description
    confidence: number;        // 0-1 confidence score
    evidence: string[];        // Supporting evidence
    lastObserved: Date;
  }>;
  
  weaknesses: Array<{
    category: string;
    description: string;
    severity: number;          // 0-1 severity score
    improvementSuggestions: string[];
    lastObserved: Date;
  }>;
  
  // Common patterns and errors
  commonErrors: Array<{
    pattern: string;           // e.g., "overextending on retake"
    frequency: number;         // How often this occurs
    context: string[];         // When this typically happens
    lastOccurrence: Date;
  }>;
  
  // Playing style and preferences
  playingStyle: {
    aggression: number;        // 0-1 scale
    teamwork: number;          // 0-1 scale  
    adaptability: number;      // 0-1 scale
    consistency: number;       // 0-1 scale
    preferredRoles: string[];  // e.g., "entry", "support"
    preferredWeapons: string[];
    preferredMaps: string[];
  };
  
  // Psychological profile
  mentalState: {
    tiltResistance: number;    // 0-1 scale
    communicationStyle: string;
    motivationFactors: string[];
    learningPreferences: string[]; // e.g., "visual", "practice-based"
  };
  
  // Progress tracking
  improvementGoals: Array<{
    goal: string;
    targetDate: Date;
    progress: number;          // 0-1 progress
    milestones: Array<{
      description: string;
      completedAt?: Date;
    }>;
  }>;
}

/**
 * Player profile memory entry
 */
export interface PlayerProfileMemory extends BaseMemoryEntry {
  type: MemoryType.PLAYER_PROFILE;
  data: PlayerProfileData;
}

// ===== Interaction History Memory =====

/**
 * Types of interactions with players
 */
export enum InteractionType {
  COACHING_FEEDBACK = 'coaching_feedback',
  STRATEGY_DISCUSSION = 'strategy_discussion',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  MENTAL_COACHING = 'mental_coaching',
  TECHNICAL_GUIDANCE = 'technical_guidance',
  TEAM_COORDINATION = 'team_coordination'
}

/**
 * Player reaction types to coaching
 */
export enum PlayerReaction {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  RESISTANT = 'resistant',
  CONFUSED = 'confused',
  ENGAGED = 'engaged',
  DEFENSIVE = 'defensive'
}

/**
 * Interaction history data
 */
export interface InteractionHistoryData {
  steamId: string;
  playerName: string;
  sessionId: string;
  
  // Interaction details
  interactionType: InteractionType;
  context: string;               // Game situation or general context
  feedbackGiven: string;         // What coaching was provided
  playerReaction: PlayerReaction;
  reactionDetails: string;       // Detailed description of reaction
  
  // Effectiveness tracking
  effectiveness: number;         // 0-1 score of how effective the coaching was
  followUp: Array<{
    timestamp: Date;
    observation: string;
    improvement: boolean;
  }>;
  
  // Game state context
  gameState?: {
    mapName: string;
    roundNumber: number;
    teamSide: 'T' | 'CT';
    score: { team: number; opponent: number };
    economyState: string;
    playersAlive: number;
  };
}

/**
 * Interaction history memory entry
 */
export interface InteractionHistoryMemory extends BaseMemoryEntry {
  type: MemoryType.INTERACTION_HISTORY;
  data: InteractionHistoryData;
}

// ===== Game Knowledge Memory =====

/**
 * Types of game knowledge
 */
export enum GameKnowledgeType {
  MAP_LAYOUT = 'map_layout',
  STRATEGY = 'strategy',
  TACTIC = 'tactic',
  ECONOMY = 'economy',
  UTILITY_USAGE = 'utility_usage',
  POSITIONING = 'positioning',
  TIMING = 'timing'
}

/**
 * Game knowledge data
 */
export interface GameKnowledgeData {
  knowledgeType: GameKnowledgeType;
  title: string;
  description: string;
  
  // Contextual information
  mapSpecific?: string[];        // Maps this applies to
  situationSpecific?: string[];  // Specific situations
  teamSide?: 'T' | 'CT' | 'both';
  
  // Content details
  keyPoints: string[];
  commonMistakes: string[];
  successIndicators: string[];
  
  // Supporting evidence
  sources: Array<{
    type: 'game_analysis' | 'professional_match' | 'coaching_session';
    description: string;
    confidence: number;
  }>;
  
  // Usage tracking
  timesReferenced: number;
  lastUsed: Date;
  effectiveness: number;         // 0-1 based on player outcomes
}

/**
 * Game knowledge memory entry
 */
export interface GameKnowledgeMemory extends BaseMemoryEntry {
  type: MemoryType.GAME_KNOWLEDGE;
  data: GameKnowledgeData;
}

// ===== Session Data Memory =====

/**
 * Current session data (short-term memory)
 */
export interface SessionData {
  sessionId: string;
  playerId: string;
  startTime: Date;
  
  // Current context
  currentMap?: string;
  currentGameMode?: string;
  currentTeamComposition?: string[];
  
  // Session-specific insights
  observedBehaviors: Array<{
    timestamp: Date;
    behavior: string;
    context: string;
    significance: number;  // 0-1 importance
  }>;
  
  // Conversation context
  recentTopics: Array<{
    topic: string;
    timestamp: Date;
    playerEngagement: number;
  }>;
  
  // Temporary notes
  coachingNotes: string[];
  pendingActions: Array<{
    action: string;
    priority: number;
    deadline?: Date;
  }>;
}

/**
 * Session data memory entry
 */
export interface SessionDataMemory extends BaseMemoryEntry {
  type: MemoryType.SESSION_DATA;
  data: SessionData;
}

// ===== Coaching Insights Memory =====

/**
 * AI-generated coaching insights
 */
export interface CoachingInsightsData {
  insightId: string;
  playerId: string;
  
  // Insight details
  insight: string;
  category: string;              // e.g., "tactical", "mental", "technical"
  confidence: number;            // 0-1 AI confidence in insight
  
  // Supporting data
  basedOn: Array<{
    dataSource: string;          // e.g., "game_stats", "interaction_history"
    dataPoints: string[];
    weight: number;              // How much this influenced the insight
  }>;
  
  // Actionable recommendations
  recommendations: Array<{
    action: string;
    priority: number;
    expectedOutcome: string;
    timeline: string;
  }>;
  
  // Validation tracking
  validated: boolean;
  validationSource?: string;
  actualOutcome?: string;
  /**
   * Historical field referenced by older code – kept for backward
   * compatibility. New code should rely on `validationSource`.
   */
  validationScore?: number;
}

/**
 * Coaching insights memory entry
 */
export interface CoachingInsightsMemory extends BaseMemoryEntry {
  type: MemoryType.COACHING_INSIGHTS;
  data: CoachingInsightsData;
}

// ===== Memory Service Interfaces =====

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'importance' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  includeExpired?: boolean;
  tagsFilter?: string[];         // Only entries with these tags
  timeRange?: {
    from: Date;
    to: Date;
  };
  importance?: MemoryImportance[];
  steamId?: string;              // Filter by specific player
}

/**
 * Memory search options for contextual retrieval
 */
export interface MemorySearchOptions extends MemoryQueryOptions {
  query: string;                 // Search query
  searchFields?: string[];       // Which fields to search in
  fuzzyMatch?: boolean;          // Allow fuzzy string matching
  contextual?: boolean;          // Use AI-based contextual search
  relevanceThreshold?: number;   // Minimum relevance score (0-1)
}

/**
 * Memory storage options
 */
export interface MemoryStorageOptions {
  forceToLongTerm?: boolean;     // Force immediate persistence to SQLite
  skipShortTerm?: boolean;       // Skip in-memory cache
  updateExisting?: boolean;      // Update if entry already exists
  mergeStrategy?: 'replace' | 'merge' | 'append';
}

/**
 * Memory retrieval result
 */
export interface MemoryRetrievalResult<T extends BaseMemoryEntry = BaseMemoryEntry> {
  entries: T[];
  totalCount: number;
  hasMore: boolean;
  searchTime: number;
  fromCache: boolean;
}

/**
 * Memory service status
 */
export interface MemoryServiceStatus {
  shortTermMemory: {
    entryCount: number;
    memoryUsage: number;         // Approximate bytes
    oldestEntry?: Date;
    newestEntry?: Date;
  };
  longTermMemory: {
    entryCount: number;
    databaseSize: number;        // Database size in bytes
    oldestEntry?: Date;
    newestEntry?: Date;
  };
  performance: {
    averageRetrievalTime: number;
    averageStorageTime: number;
    cacheHitRate: number;
  };
}


// ===== Memory Service Interface =====

/**
 * Main MemoryService interface defining all operations
 */
export interface IMemoryService {
  // ===== Initialization =====
  initialize(): Promise<void>;
  isInitialized(): boolean;
  dispose(): Promise<void>;
  
  // ===== Storage Operations =====
  store<T extends BaseMemoryEntry>(
    entry: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, 
    options?: MemoryStorageOptions
  ): Promise<string>; // Returns entry ID
  
  update<T extends BaseMemoryEntry>(
    entryId: string, 
    updates: Partial<T>, 
    options?: MemoryStorageOptions
  ): Promise<boolean>;
  
  delete(entryId: string): Promise<boolean>;
  
  // ===== Retrieval Operations =====
  get<T extends BaseMemoryEntry>(entryId: string): Promise<T | null>;
  
  query<T extends BaseMemoryEntry>(
    filters: {
      type?: MemoryType;
      steamId?: string;
      tags?: string[];
    },
    options?: MemoryQueryOptions
  ): Promise<MemoryRetrievalResult<T>>;
  
  search<T extends BaseMemoryEntry>(
    searchOptions: MemorySearchOptions
  ): Promise<MemoryRetrievalResult<T>>;
  
  // ===== Specialized Retrieval Methods =====
  getPlayerProfile(steamId: string): Promise<PlayerProfileMemory | null>;
  getInteractionHistory(
    steamId: string, 
    options?: MemoryQueryOptions
  ): Promise<MemoryRetrievalResult<InteractionHistoryMemory>>;
  
  getGameKnowledge(
    knowledgeType?: GameKnowledgeType,
    context?: { mapName?: string; situation?: string },
    options?: MemoryQueryOptions
  ): Promise<MemoryRetrievalResult<GameKnowledgeMemory>>;
  
  getSessionData(sessionId: string): Promise<SessionDataMemory | null>;
  getCurrentSessionData(playerId: string): Promise<SessionDataMemory | null>;
  
  getCoachingInsights(
    playerId: string,
    options?: MemoryQueryOptions
  ): Promise<MemoryRetrievalResult<CoachingInsightsMemory>>;
  
  // ===== Context-Aware Operations =====
  getContextualMemories(
    context: {
      playerId: string;
      currentSituation?: string;
      mapName?: string;
      recentTopics?: string[];
    },
    options?: MemoryQueryOptions
  ): Promise<MemoryRetrievalResult>;
  
  // ===== Memory Management =====
  cleanupExpiredEntries(): Promise<number>; // Returns count of cleaned entries
  promoteToLongTerm(entryId: string): Promise<boolean>;
  demoteToShortTerm(entryId: string): Promise<boolean>;
  
  // ===== Statistics and Health =====
  getStatus(): Promise<MemoryServiceStatus>;
  getMemoryUsage(): Promise<{ shortTerm: number; longTerm: number }>;
  
  // ===== Cache Management =====
  clearShortTermMemory(): Promise<void>;
  warmupCache(steamId?: string): Promise<void>;
  
  // ===== Backup and Maintenance =====
  exportMemories(
    filters?: { type?: MemoryType; steamId?: string },
    format?: 'json' | 'csv'
  ): Promise<string>; // Returns file path or JSON string
  
  importMemories(data: string | BaseMemoryEntry[]): Promise<number>; // Returns count imported
  
  // ===== Health Check =====
  healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }>;
} 