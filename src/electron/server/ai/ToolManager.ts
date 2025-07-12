import { v4 as uuidv4 } from 'uuid';
import { ITool, ISimpleTool, ToolExecutionContext, ToolExecutionResult, ToolCategory, ToolPriority } from './interfaces/ITool.js';

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  override?: boolean; // Whether to override existing tools with the same name
  priority?: ToolPriority; // Execution priority for the tool
  enabled?: boolean; // Whether the tool is enabled (default: true)
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  timeout?: number; // Execution timeout in milliseconds (default: 30000)
  retries?: number; // Number of retry attempts (default: 0)
  priority?: ToolPriority; // Override tool priority for this execution
  metadata?: Record<string, any>; // Additional metadata for execution context
}

/**
 * Tool registry entry
 */
interface ToolRegistryEntry {
  tool: ITool | ISimpleTool;
  registrationDate: Date;
  lastUsed?: Date;
  executionCount: number;
  priority: ToolPriority;
  enabled: boolean;
}

/**
 * Tool execution statistics
 */
export interface ToolExecutionStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  lastError?: string;
}

/**
 * Tool manager events
 */
export enum ToolManagerEvent {
  TOOL_REGISTERED = 'tool-registered',
  TOOL_UNREGISTERED = 'tool-unregistered',
  TOOL_EXECUTED = 'tool-executed',
  TOOL_FAILED = 'tool-failed',
  TOOL_ENABLED = 'tool-enabled',
  TOOL_DISABLED = 'tool-disabled'
}

/**
 * Event listener type for tool manager events
 */
export type ToolManagerEventListener = (event: {
  type: ToolManagerEvent;
  toolName: string;
  data?: any;
  timestamp: Date;
}) => void;

/**
 * Central manager for AI tools registration, discovery, and execution
 * 
 * This class provides a thread-safe way to register, manage, and execute AI tools.
 * It includes features like tool discovery, health monitoring, execution statistics,
 * and error handling.
 */
export class ToolManager {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private executionStats: Map<string, ToolExecutionStats> = new Map();
  private eventListeners: Map<ToolManagerEvent, ToolManagerEventListener[]> = new Map();
  private readonly lockMap: Map<string, boolean> = new Map();

  /**
   * Register a new tool with the manager
   * @param tool - The tool instance to register
   * @param options - Registration options
   * @returns True if registration was successful, false otherwise
   */
  public register(tool: ITool | ISimpleTool, options: ToolRegistrationOptions = {}): boolean {
    const { override = false, priority = ToolPriority.NORMAL, enabled = true } = options;

    // Validate tool
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid description');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have a valid execute method');
    }

    // Check for duplicate registration
    if (this.tools.has(tool.name) && !override) {
      throw new Error(`Tool '${tool.name}' is already registered. Use override option to replace.`);
    }

    // Register the tool
    const registryEntry: ToolRegistryEntry = {
      tool,
      registrationDate: new Date(),
      executionCount: 0,
      priority,
      enabled
    };

    this.tools.set(tool.name, registryEntry);

    // Initialize execution stats
    this.executionStats.set(tool.name, {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0
    });

    // Emit registration event
    this.emitEvent(ToolManagerEvent.TOOL_REGISTERED, tool.name, {
      priority,
      enabled,
      category: tool.metadata?.category
    });

    return true;
  }

  /**
   * Unregister a tool from the manager
   * @param toolName - Name of the tool to unregister
   * @returns True if unregistration was successful, false otherwise
   */
  public unregister(toolName: string): boolean {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }

    // Call cleanup method if available
    if (entry.tool.dispose) {
      entry.tool.dispose().catch(error => {
        console.error(`Error during tool cleanup for '${toolName}':`, error);
      });
    }

    // Remove from registry
    this.tools.delete(toolName);
    this.executionStats.delete(toolName);
    this.lockMap.delete(toolName);

    // Emit unregistration event
    this.emitEvent(ToolManagerEvent.TOOL_UNREGISTERED, toolName);

    return true;
  }

  /**
   * Execute a tool by name with provided input
   * @param toolName - Name of the tool to execute
   * @param input - Input parameters for the tool
   * @param options - Execution options
   * @returns Promise resolving to the tool execution result
   */
  public async execute<T = any>(
    toolName: string,
    input: any,
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult<T>> {
    return this._executeInternal(toolName, input, options);
  }

  /**
   * Back-compat alias expected by older orchestrator code.
   * Delegates to execute().
   */
  public async executeTool<T = any>(
    toolName: string,
    input: any,
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult<T>> {
    return this.execute<T>(toolName, input, options);
  }

  // Renamed core implementation to avoid recursive call.
  private async _executeInternal<T = any>(
    toolName: string,
    input: any,
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult<T>> {
    const startTime = Date.now();
    const requestId = uuidv4();
    const { timeout = 30000, retries = 0, priority, metadata = {} } = options;

    // Get tool entry
    const entry = this.tools.get(toolName);
    if (!entry) {
      const error = {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${toolName}' is not registered`,
          details: { availableTools: Array.from(this.tools.keys()) }
        }
      } as ToolExecutionResult<T>;
      
      this.emitEvent(ToolManagerEvent.TOOL_FAILED, toolName, error);
      return error;
    }

    // Check if tool is enabled
    if (!entry.enabled) {
      const error = {
        success: false,
        error: {
          code: 'TOOL_DISABLED',
          message: `Tool '${toolName}' is currently disabled`,
          details: { toolName }
        }
      } as ToolExecutionResult<T>;
      
      this.emitEvent(ToolManagerEvent.TOOL_FAILED, toolName, error);
      return error;
    }

    // Check for concurrent execution lock (basic thread safety)
    if (this.lockMap.get(toolName)) {
      const error = {
        success: false,
        error: {
          code: 'TOOL_BUSY',
          message: `Tool '${toolName}' is currently being executed by another request`,
          details: { toolName }
        }
      } as ToolExecutionResult<T>;
      
      this.emitEvent(ToolManagerEvent.TOOL_FAILED, toolName, error);
      return error;
    }

    // Attempt execution with retries
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.lockMap.set(toolName, true);
        
        const result = await this.executeWithTimeout<T>(
          entry.tool,
          input,
          {
            requestId,
            timestamp: new Date(),
            metadata: {
              ...metadata,
              attempt: attempt + 1,
              maxAttempts: retries + 1,
              priority: priority || entry.priority
            }
          },
          timeout
        );

        // Update statistics
        this.updateExecutionStats(toolName, true, Date.now() - startTime);
        entry.lastUsed = new Date();
        entry.executionCount++;

        // Emit success event
        this.emitEvent(ToolManagerEvent.TOOL_EXECUTED, toolName, {
          success: true,
          executionTime: Date.now() - startTime,
          attempt: attempt + 1
        });

        return result;
      } catch (error) {
        lastError = error;
        
        // If this is the last attempt, break the loop
        if (attempt === retries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        this.lockMap.set(toolName, false);
      }
    }

    // All attempts failed
    const errorResult = {
      success: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: `Tool '${toolName}' execution failed after ${retries + 1} attempts`,
        details: { 
          originalError: lastError?.message || 'Unknown error',
          attempts: retries + 1,
          lastError
        }
      },
      metadata: {
        executionTimeMs: Date.now() - startTime,
        attempts: retries + 1
      }
    } as ToolExecutionResult<T>;

    // Update statistics
    this.updateExecutionStats(toolName, false, Date.now() - startTime, lastError?.message);

    // Emit failure event
    this.emitEvent(ToolManagerEvent.TOOL_FAILED, toolName, errorResult);

    return errorResult;
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout<T>(
    tool: ITool | ISimpleTool,
    input: any,
    context: ToolExecutionContext,
    timeout: number
  ): Promise<ToolExecutionResult<T>> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      try {
        let result: ToolExecutionResult<T>;

        // Check if it's a full ITool with validation
        if ('validateInput' in tool && typeof tool.validateInput === 'function') {
          const validation = tool.validateInput(input);
          if (!validation.isValid) {
            resolve({
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: 'Input validation failed',
                details: validation.errors
              }
            });
            return;
          }
          
          result = await tool.execute(input, context);
        } else {
          // Simple tool execution
          const data = await (tool as ISimpleTool).execute(input);
          result = {
            success: true,
            data,
            metadata: {
              executionTimeMs: Date.now() - context.timestamp.getTime(),
              source: tool.name
            }
          };
        }

        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Get list of registered tools
   * @param options - Filtering options
   * @returns Array of tool information
   */
  public getTools(options: {
    category?: string;
    enabled?: boolean;
    includeStats?: boolean;
  } = {}): Array<{
    name: string;
    description: string;
    category: string;
    enabled: boolean;
    priority: ToolPriority;
    registrationDate: Date;
    lastUsed?: Date;
    executionCount: number;
    stats?: ToolExecutionStats;
  }> {
    const { category, enabled, includeStats = false } = options;

    return Array.from(this.tools.entries())
      .filter(([_, entry]) => {
        if (category && entry.tool.metadata?.category !== category) return false;
        if (enabled !== undefined && entry.enabled !== enabled) return false;
        return true;
      })
      .map(([name, entry]) => ({
        name,
        description: entry.tool.description,
        category: entry.tool.metadata?.category || 'unknown',
        enabled: entry.enabled,
        priority: entry.priority,
        registrationDate: entry.registrationDate,
        lastUsed: entry.lastUsed,
        executionCount: entry.executionCount,
        ...(includeStats && { stats: this.executionStats.get(name) })
      }));
  }

  /**
   * Enable or disable a tool
   * @param toolName - Name of the tool
   * @param enabled - Whether to enable or disable
   * @returns True if operation was successful
   */
  public setToolEnabled(toolName: string, enabled: boolean): boolean {
    const entry = this.tools.get(toolName);
    if (!entry) {
      return false;
    }

    entry.enabled = enabled;
    this.emitEvent(
      enabled ? ToolManagerEvent.TOOL_ENABLED : ToolManagerEvent.TOOL_DISABLED,
      toolName
    );

    return true;
  }

  /**
   * Get execution statistics for a tool
   * @param toolName - Name of the tool
   * @returns Execution statistics or undefined if not found
   */
  public getToolStats(toolName: string): ToolExecutionStats | undefined {
    return this.executionStats.get(toolName);
  }

  /**
   * Check if a tool is registered
   * @param toolName - Name of the tool
   * @returns True if tool is registered
   */
  public hasToolCheck(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool by name
   * @param toolName - Name of the tool
   * @returns Tool instance or undefined if not found
   */
  public getTool(toolName: string): ITool | ISimpleTool | undefined {
    return this.tools.get(toolName)?.tool;
  }

  /**
   * Add event listener
   * @param event - Event type to listen for
   * @param listener - Event listener function
   */
  public addEventListener(event: ToolManagerEvent, listener: ToolManagerEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   * @param event - Event type
   * @param listener - Event listener function to remove
   */
  public removeEventListener(event: ToolManagerEvent, listener: ToolManagerEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Perform health check on all tools
   * @returns Health status of all tools
   */
  public async healthCheck(): Promise<Record<string, {
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }>> {
    const results: Record<string, any> = {};

    for (const [name, entry] of Array.from(this.tools.entries())) {
      if ('healthCheck' in entry.tool && typeof (entry.tool as ITool).healthCheck === 'function') {
        try {
          results[name] = await (entry.tool as ITool).healthCheck!();
        } catch (error) {
          results[name] = {
            healthy: false,
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error }
          };
        }
      } else {
        results[name] = {
          healthy: true,
          message: 'No health check available'
        };
      }
    }

    return results;
  }

  /**
   * Clear all tools and reset manager
   */
  public clear(): void {
    // Call dispose on all tools
    for (const [name, entry] of Array.from(this.tools.entries())) {
      if (entry.tool.dispose) {
        entry.tool.dispose().catch(error => {
          console.error(`Error during tool cleanup for '${name}':`, error);
        });
      }
    }

    this.tools.clear();
    this.executionStats.clear();
    this.lockMap.clear();
    this.eventListeners.clear();
  }

  /**
   * Update execution statistics
   */
  private updateExecutionStats(
    toolName: string,
    success: boolean,
    executionTime: number,
    error?: string
  ): void {
    const stats = this.executionStats.get(toolName);
    if (!stats) return;

    stats.totalExecutions++;
    stats.lastExecution = new Date();

    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
      if (error) {
        stats.lastError = error;
      }
    }

    // Update average execution time
    stats.averageExecutionTime = 
      (stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime) / stats.totalExecutions;
  }

  /**
   * Emit tool manager event
   */
  private emitEvent(type: ToolManagerEvent, toolName: string, data?: any): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event = {
        type,
        toolName,
        data,
        timestamp: new Date()
      };

      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in tool manager event listener:`, error);
        }
      });
    }
  }
}

/**
 * Singleton instance of the tool manager
 */
export const toolManager = new ToolManager();