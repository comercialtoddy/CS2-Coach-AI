/**
 * Short-Term Memory (In-Memory) Schemas and Data Structures
 * 
 * This file defines the in-memory cache structures, LRU cache implementation,
 * and data management for the MemoryService's short-term memory component.
 * Optimized for fast access and efficient memory usage.
 */

import { 
  BaseMemoryEntry, 
  MemoryType, 
  MemoryImportance,
  PlayerProfileMemory,
  InteractionHistoryMemory,
  GameKnowledgeMemory,
  SessionDataMemory,
  CoachingInsightsMemory
} from '../interfaces/MemoryService.js';

// ===== Cache Entry Structures =====

/**
 * Base cache entry with metadata for all memory types
 */
export interface CacheEntry<T extends BaseMemoryEntry = BaseMemoryEntry> {
  data: T;
  timestamp: number;           // When cached (ms since epoch)
  lastAccessed: number;        // Last access time (ms since epoch)
  accessCount: number;         // Number of times accessed
  expiryTime: number;          // Expiration time (ms since epoch)
  size: number;                // Approximate size in bytes
  priority: number;            // Computed priority score (0-1)
  source: 'shortterm' | 'promoted' | 'session';
  metadata: {
    promoted?: boolean;        // Was promoted from long-term
    dirty?: boolean;           // Has unsaved changes
    sessionId?: string;        // Associated session
    playerId?: string;         // Associated player
  };
}

/**
 * Cache statistics for monitoring and optimization
 */
export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;         // Total memory usage in bytes
  hitCount: number;            // Cache hits
  missCount: number;           // Cache misses
  evictionCount: number;       // Number of evictions
  oldestEntryAge: number;      // Age of oldest entry in ms
  newestEntryAge: number;      // Age of newest entry in ms
  averageAccessCount: number;
  memoryEfficiency: number;    // Memory efficiency score (0-1)
}

/**
 * LRU Cache Node for efficient cache management
 */
interface LRUNode<T> {
  key: string;
  value: T;
  prev: LRUNode<T> | null;
  next: LRUNode<T> | null;
  frequency: number;           // Access frequency for LFU aspects
  lastAccess: number;          // Last access timestamp
}

// ===== Cache Configuration =====

/**
 * Cache configuration options
 */
export interface CacheConfig {
  maxEntries: number;          // Maximum number of entries
  maxMemoryMB: number;         // Maximum memory usage in MB
  defaultTTL: number;          // Default TTL in milliseconds
  cleanupInterval: number;     // Cleanup interval in milliseconds
  evictionPolicy: 'lru' | 'lfu' | 'adaptive';
  preloadStrategies: {
    playerProfiles: boolean;   // Preload frequently accessed players
    recentSessions: boolean;   // Keep recent session data hot
    gameKnowledge: boolean;    // Cache frequently used game knowledge
  };
}

/**
 * Default cache configuration based on memory type
 */
export const DEFAULT_CACHE_CONFIG: Record<MemoryType, CacheConfig> = {
  [MemoryType.PLAYER_PROFILE]: {
    maxEntries: 50,              // Limited active players
    maxMemoryMB: 10,
    defaultTTL: 60 * 60 * 1000,  // 1 hour
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    evictionPolicy: 'adaptive',
    preloadStrategies: {
      playerProfiles: true,
      recentSessions: false,
      gameKnowledge: false
    }
  },
  [MemoryType.INTERACTION_HISTORY]: {
    maxEntries: 200,             // Recent interactions
    maxMemoryMB: 5,
    defaultTTL: 30 * 60 * 1000,  // 30 minutes
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
    evictionPolicy: 'lru',
    preloadStrategies: {
      playerProfiles: false,
      recentSessions: true,
      gameKnowledge: false
    }
  },
  [MemoryType.GAME_KNOWLEDGE]: {
    maxEntries: 100,             // Core game knowledge
    maxMemoryMB: 8,
    defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
    cleanupInterval: 15 * 60 * 1000, // 15 minutes
    evictionPolicy: 'lfu',
    preloadStrategies: {
      playerProfiles: false,
      recentSessions: false,
      gameKnowledge: true
    }
  },
  [MemoryType.SESSION_DATA]: {
    maxEntries: 10,              // Active sessions
    maxMemoryMB: 3,
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    cleanupInterval: 60 * 1000,   // 1 minute
    evictionPolicy: 'lru',
    preloadStrategies: {
      playerProfiles: false,
      recentSessions: true,
      gameKnowledge: false
    }
  },
  [MemoryType.COACHING_INSIGHTS]: {
    maxEntries: 75,              // Recent insights
    maxMemoryMB: 4,
    defaultTTL: 45 * 60 * 1000,  // 45 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    evictionPolicy: 'adaptive',
    preloadStrategies: {
      playerProfiles: true,
      recentSessions: true,
      gameKnowledge: false
    }
  }
};

// ===== Specialized Cache Structures =====

/**
 * Player-specific cache for quick access to player-related data
 */
export interface PlayerCache {
  steamId: string;
  playerName: string;
  lastActivity: number;        // Last activity timestamp
  
  // Cached data by type
  profile?: CacheEntry<PlayerProfileMemory>;
  recentInteractions: CacheEntry<InteractionHistoryMemory>[];
  currentSession?: CacheEntry<SessionDataMemory>;
  activeInsights: CacheEntry<CoachingInsightsMemory>[];
  
  // Quick access metrics
  accessFrequency: number;
  totalMemoryUsage: number;
  cacheEfficiency: number;     // Hit rate for this player
}

/**
 * Session-specific cache for active gaming sessions
 */
export interface SessionCache {
  sessionId: string;
  playerId: string;
  startTime: number;
  isActive: boolean;
  
  // Session data
  sessionData: CacheEntry<SessionDataMemory>;
  contextualKnowledge: CacheEntry<GameKnowledgeMemory>[];
  realtimeInsights: CacheEntry<CoachingInsightsMemory>[];
  
  // Performance tracking
  memoryUsage: number;
  interactionCount: number;
  lastUpdateTime: number;
}

/**
 * Contextual cache for situational game knowledge
 */
export interface ContextualCache {
  context: string;             // Context identifier (e.g., "dust2_tside_eco")
  relevanceScore: number;      // How relevant this context is (0-1)
  lastUsed: number;
  
  // Associated data
  gameKnowledge: CacheEntry<GameKnowledgeMemory>[];
  applicableInsights: CacheEntry<CoachingInsightsMemory>[];
  
  // Usage metrics
  timesReferenced: number;
  averageUtility: number;      // How useful this context has been
}

// ===== LRU Cache Implementation =====

/**
 * Enhanced LRU Cache with LFU characteristics and memory management
 */
export class EnhancedLRUCache<T> {
  private capacity: number;
  private maxMemoryBytes: number;
  private cache: Map<string, LRUNode<CacheEntry<T>>>;
  private head: LRUNode<CacheEntry<T>>;
  private tail: LRUNode<CacheEntry<T>>;
  private currentMemoryUsage: number;
  private stats: CacheStats;
  
  constructor(capacity: number, maxMemoryMB: number) {
    this.capacity = capacity;
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024; // Convert MB to bytes
    this.cache = new Map();
    this.currentMemoryUsage = 0;
    
    // Initialize dummy head and tail nodes
    this.head = { key: '', value: {} as CacheEntry<T>, prev: null, next: null, frequency: 0, lastAccess: 0 };
    this.tail = { key: '', value: {} as CacheEntry<T>, prev: null, next: null, frequency: 0, lastAccess: 0 };
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    this.stats = {
      totalEntries: 0,
      memoryUsage: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      oldestEntryAge: 0,
      newestEntryAge: 0,
      averageAccessCount: 0,
      memoryEfficiency: 0
    };
  }
  
  /**
   * Get entry from cache
   */
  get(key: string): CacheEntry<T> | null {
    const node = this.cache.get(key);
    
    if (!node) {
      this.stats.missCount++;
      return null;
    }
    
    // Check if expired
    const now = Date.now();
    if (node.value.expiryTime < now) {
      this.remove(key);
      this.stats.missCount++;
      return null;
    }
    
    // Update access information
    node.value.lastAccessed = now;
    node.value.accessCount++;
    node.frequency++;
    node.lastAccess = now;
    
    // Move to head (most recently used)
    this.moveToHead(node);
    
    this.stats.hitCount++;
    return node.value;
  }
  
  /**
   * Put entry in cache
   */
  put(key: string, value: CacheEntry<T>): boolean {
    const existing = this.cache.get(key);
    const now = Date.now();
    
    if (existing) {
      // Update existing entry
      const sizeDiff = value.size - existing.value.size;
      existing.value = value;
      existing.lastAccess = now;
      existing.frequency++;
      this.currentMemoryUsage += sizeDiff;
      this.moveToHead(existing);
      return true;
    }
    
    // Check memory constraints before adding
    if (this.currentMemoryUsage + value.size > this.maxMemoryBytes) {
      if (!this.evictToMakeSpace(value.size)) {
        return false; // Could not make enough space
      }
    }
    
    // Check capacity constraints
    if (this.cache.size >= this.capacity) {
      this.evictLeastValuable();
    }
    
    // Create new node
    const newNode: LRUNode<CacheEntry<T>> = {
      key,
      value,
      prev: null,
      next: null,
      frequency: 1,
      lastAccess: now
    };
    
    this.cache.set(key, newNode);
    this.addToHead(newNode);
    this.currentMemoryUsage += value.size;
    this.stats.totalEntries++;
    
    return true;
  }
  
  /**
   * Remove entry from cache
   */
  remove(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;
    
    this.cache.delete(key);
    this.removeNode(node);
    this.currentMemoryUsage -= node.value.size;
    this.stats.totalEntries--;
    
    return true;
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.currentMemoryUsage = 0;
    this.stats.totalEntries = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let oldestAge = 0;
    let newestAge = Number.MAX_SAFE_INTEGER;
    let totalAccessCount = 0;
    
    for (const node of this.cache.values()) {
      const age = now - node.value.timestamp;
      oldestAge = Math.max(oldestAge, age);
      newestAge = Math.min(newestAge, age);
      totalAccessCount += node.value.accessCount;
    }
    
    this.stats.memoryUsage = this.currentMemoryUsage;
    this.stats.oldestEntryAge = oldestAge;
    this.stats.newestEntryAge = newestAge === Number.MAX_SAFE_INTEGER ? 0 : newestAge;
    this.stats.averageAccessCount = this.stats.totalEntries > 0 ? totalAccessCount / this.stats.totalEntries : 0;
    this.stats.memoryEfficiency = this.stats.hitCount / Math.max(1, this.stats.hitCount + this.stats.missCount);
    
    return { ...this.stats };
  }
  
  /**
   * Get all keys in order of access (most recent first)
   */
  getKeys(): string[] {
    const keys: string[] = [];
    let current = this.head.next;
    
    while (current && current !== this.tail) {
      keys.push(current.key);
      current = current.next;
    }
    
    return keys;
  }
  
  /**
   * Get entries that match a predicate
   */
  getEntriesWhere(predicate: (entry: CacheEntry<T>) => boolean): Array<{ key: string; value: CacheEntry<T> }> {
    const results: Array<{ key: string; value: CacheEntry<T> }> = [];
    
    for (const [key, node] of this.cache) {
      if (predicate(node.value)) {
        results.push({ key, value: node.value });
      }
    }
    
    return results;
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;
    const keysToRemove: string[] = [];
    
    for (const [key, node] of this.cache) {
      if (node.value.expiryTime < now) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.remove(key);
      cleanedCount++;
    }
    
    return cleanedCount;
  }
  
  // ===== Private Helper Methods =====
  
  private addToHead(node: LRUNode<CacheEntry<T>>): void {
    node.prev = this.head;
    node.next = this.head.next;
    
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }
  
  private removeNode(node: LRUNode<CacheEntry<T>>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }
  
  private moveToHead(node: LRUNode<CacheEntry<T>>): void {
    this.removeNode(node);
    this.addToHead(node);
  }
  
  private evictLeastValuable(): void {
    const lru = this.tail.prev;
    if (lru && lru !== this.head) {
      this.cache.delete(lru.key);
      this.removeNode(lru);
      this.currentMemoryUsage -= lru.value.size;
      this.stats.evictionCount++;
      this.stats.totalEntries--;
    }
  }
  
  private evictToMakeSpace(neededBytes: number): boolean {
    let freedBytes = 0;
    const toEvict: string[] = [];
    
    // Find least valuable entries to evict
    let current = this.tail.prev;
    while (current && current !== this.head && freedBytes < neededBytes) {
      toEvict.push(current.key);
      freedBytes += current.value.size;
      current = current.prev;
    }
    
    // Evict the selected entries
    for (const key of toEvict) {
      this.remove(key);
      this.stats.evictionCount++;
    }
    
    return freedBytes >= neededBytes;
  }
}

// ===== Cache Manager Structure =====

/**
 * Cache manager that coordinates all short-term memory caches
 */
export interface ShortTermMemoryManager {
  // Type-specific caches
  playerProfiles: EnhancedLRUCache<PlayerProfileMemory>;
  interactionHistory: EnhancedLRUCache<InteractionHistoryMemory>;
  gameKnowledge: EnhancedLRUCache<GameKnowledgeMemory>;
  sessionData: EnhancedLRUCache<SessionDataMemory>;
  coachingInsights: EnhancedLRUCache<CoachingInsightsMemory>;
  
  // Specialized indexes
  playerIndex: Map<string, PlayerCache>;      // steamId -> PlayerCache
  sessionIndex: Map<string, SessionCache>;    // sessionId -> SessionCache
  contextIndex: Map<string, ContextualCache>; // context -> ContextualCache
  
  // Global metrics
  globalStats: {
    totalMemoryUsage: number;
    totalEntries: number;
    globalHitRate: number;
    lastCleanup: number;
    startTime: number;
  };
  
  // Configuration
  config: {
    globalMaxMemoryMB: number;
    cleanupIntervalMs: number;
    enablePreloading: boolean;
    enableContextualCaching: boolean;
  };
}

// ===== Utility Functions =====

/**
 * Calculate the approximate size of a memory entry in bytes
 */
export function calculateEntrySize(entry: BaseMemoryEntry): number {
  try {
    // Rough estimation based on JSON serialization
    const jsonString = JSON.stringify(entry);
    return jsonString.length * 2; // Approximate size in bytes (UTF-16)
  } catch (error) {
    // Fallback estimation
    return 1024; // 1KB default
  }
}

/**
 * Compute priority score for cache entry based on multiple factors
 */
export function computePriorityScore(entry: CacheEntry): number {
  const now = Date.now();
  const age = now - entry.timestamp;
  const timeSinceAccess = now - entry.lastAccessed;
  
  // Factors affecting priority (normalized to 0-1)
  const accessFrequency = Math.min(entry.accessCount / 10, 1);
  const recency = Math.max(0, 1 - (timeSinceAccess / (24 * 60 * 60 * 1000))); // Decay over 24h
  const importanceWeight = getImportanceWeight(entry.data.importance);
  const typeWeight = getTypeWeight(entry.data.type);
  
  // Weighted combination
  return (
    accessFrequency * 0.3 +
    recency * 0.25 +
    importanceWeight * 0.25 +
    typeWeight * 0.2
  );
}

/**
 * Get importance weight for priority calculation
 */
function getImportanceWeight(importance: MemoryImportance): number {
  switch (importance) {
    case MemoryImportance.CRITICAL: return 1.0;
    case MemoryImportance.HIGH: return 0.8;
    case MemoryImportance.MEDIUM: return 0.5;
    case MemoryImportance.LOW: return 0.3;
    case MemoryImportance.TEMPORARY: return 0.1;
    default: return 0.5;
  }
}

/**
 * Get type weight for priority calculation
 */
function getTypeWeight(type: MemoryType): number {
  switch (type) {
    case MemoryType.SESSION_DATA: return 1.0;      // Highest priority
    case MemoryType.PLAYER_PROFILE: return 0.8;    // High priority
    case MemoryType.COACHING_INSIGHTS: return 0.7; // High priority
    case MemoryType.INTERACTION_HISTORY: return 0.6; // Medium priority
    case MemoryType.GAME_KNOWLEDGE: return 0.5;    // Medium priority
    default: return 0.5;
  }
} 