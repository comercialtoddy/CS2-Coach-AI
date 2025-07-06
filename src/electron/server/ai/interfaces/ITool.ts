/**
 * Schema definition for tool input parameters
 */
export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  properties?: Record<string, ToolParameterSchema>; // For object types
  items?: ToolParameterSchema; // For array types
  enum?: any[]; // For enum values
  default?: any; // Default value
}

/**
 * Tool execution context containing request information and utilities
 */
export interface ToolExecutionContext {
  requestId: string; // Unique identifier for this execution
  timestamp: Date; // When the tool was executed
  userId?: string; // User who triggered the execution (if applicable)
  sessionId?: string; // Session identifier
  metadata?: Record<string, any>; // Additional context data
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTimeMs: number;
    cached?: boolean;
    source?: string; // Where the data came from
    [key: string]: any;
  };
}

/**
 * Tool configuration and metadata
 */
export interface ToolMetadata {
  version: string; // Tool version for compatibility
  category: string; // Tool category (e.g., 'data', 'analysis', 'communication')
  tags: string[]; // Tags for discovery and filtering
  author?: string; // Tool author
  lastUpdated?: Date; // Last update timestamp
  deprecated?: boolean; // Whether the tool is deprecated
  experimental?: boolean; // Whether the tool is experimental
}

/**
 * Core interface that all AI tools must implement
 * 
 * This interface defines the contract for tools that can be used by the AI agent.
 * Each tool should be self-contained and provide clear input/output specifications.
 */
export interface ITool<TInput = any, TOutput = any> {
  /**
   * Unique identifier for the tool (kebab-case recommended)
   * Examples: 'get-player-stats', 'analyze-gameplay', 'fetch-tracker-data'
   */
  readonly name: string;

  /**
   * Human-readable description of what the tool does
   * This should be clear enough for an AI to understand when to use this tool
   */
  readonly description: string;

  /**
   * Detailed schema defining the input parameters this tool accepts
   * This enables parameter validation and helps the AI understand what data to provide
   */
  readonly inputSchema: Record<string, ToolParameterSchema>;

  /**
   * Example of expected output structure (for AI understanding)
   * This helps the AI know what to expect from the tool execution
   */
  readonly outputExample: TOutput;

  /**
   * Tool metadata for versioning, categorization, and management
   */
  readonly metadata: ToolMetadata;

  /**
   * Validates input parameters against the tool's schema
   * @param input - Input parameters to validate
   * @returns Validation result with details about any errors
   */
  validateInput(input: TInput): {
    isValid: boolean;
    errors?: Array<{
      parameter: string;
      message: string;
      receivedType?: string;
      expectedType?: string;
    }>;
  };

  /**
   * Main execution method for the tool
   * @param input - Validated input parameters
   * @param context - Execution context with metadata and utilities
   * @returns Promise resolving to the tool execution result
   */
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>>;

  /**
   * Optional cleanup method called when the tool is being disposed
   * Useful for closing connections, clearing caches, etc.
   */
  dispose?(): Promise<void>;

  /**
   * Optional health check method to verify the tool is ready for use
   * @returns Promise resolving to health status
   */
  healthCheck?(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }>;
}

/**
 * Simplified tool interface for basic tools that don't need complex validation
 */
export interface ISimpleTool<TInput = any, TOutput = any> extends Omit<ITool<TInput, TOutput>, 'validateInput' | 'healthCheck' | 'execute'> {
  /**
   * Simplified execution method
   */
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Tool categories for organization and discovery
 */
export enum ToolCategory {
  DATA_RETRIEVAL = 'data',
  ANALYSIS = 'analysis', 
  COMMUNICATION = 'communication',
  UTILITY = 'utility',
  EXTERNAL_API = 'external-api',
  DATABASE = 'database',
  FILE_SYSTEM = 'file-system',
  GAME_STATE = 'game-state',
  PLAYER_MANAGEMENT = 'player-management',
  AUDIO_PROCESSING = 'audio-processing'
}

/**
 * Tool execution priority levels
 */
export enum ToolPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
  BACKGROUND = 'background'
} 