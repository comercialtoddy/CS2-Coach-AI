/**
 * OpenHud AI Tooling Framework
 * 
 * This module provides a comprehensive framework for implementing AI agent tools
 * within the OpenHud application. It enables step-by-step AI processing through
 * encapsulated, callable tools.
 * 
 * @author OpenHud AI System
 * @version 1.0.0
 */

import { 
  ITool,
  ISimpleTool,
  ToolParameterSchema,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolMetadata,
  ToolCategory,
  ToolPriority
} from './interfaces/ITool.js';

import {
  ToolManager,
  toolManager,
  ToolManagerEvent,
  type ToolRegistrationOptions,
  type ToolExecutionOptions,
  type ToolExecutionStats,
  type ToolManagerEventListener,
} from './ToolManager.js';

import {
  PlayerDataTool,
  type PlayerDataToolInput,
  type PlayerDataToolOutput
} from './tools/ExamplePlayerTool.js';

import { registerCoreDataRetrievalTools } from './tools/registerCoreDataRetrievalTools.js';
import { registerScreenshotTool } from './tools/registerScreenshotTool.js';

import {
  AIToolingTest
} from './AIToolingTest.js';

// Core interfaces and types
export type {
  ITool,
  ISimpleTool,
  ToolParameterSchema,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolMetadata,
  ToolRegistrationOptions,
  ToolExecutionOptions,
  ToolExecutionStats,
  ToolManagerEventListener,
  PlayerDataToolInput,
  PlayerDataToolOutput
};

// Export core classes and instances
export {
  ToolManager,
  toolManager,
  ToolCategory,
  ToolPriority,
  PlayerDataTool,
  AIToolingTest
};

/**
 * Quick start helper function to initialize the AI tooling framework
 * with common tools and configurations
 * 
 * @param options - Initialization options
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeAITooling(options: {
  registerExampleTools?: boolean;
  enableEventLogging?: boolean;
  healthCheckInterval?: number; // in milliseconds
} = {}): Promise<{
  toolManager: ToolManager;
  registeredTools: string[];
  healthStatus: Record<string, any>;
}> {
  const {
    registerExampleTools = true,
    enableEventLogging = false,
    healthCheckInterval = 300000 // 5 minutes
  } = options;

  const registeredTools: string[] = [];

  // Register example tools if requested
  if (registerExampleTools) {
    try {
      const playerTool = new PlayerDataTool();
      toolManager.register(playerTool);
      registeredTools.push(playerTool.name);
      console.log(`✅ Registered example tool: ${playerTool.name}`);
    } catch (error) {
      console.error('❌ Failed to register example tools:', error);
    }
  }

  // Register core data retrieval tools
  try {
    registerCoreDataRetrievalTools(toolManager);
    registeredTools.push('get-gsi-info', 'get-trackergg-stats', 'update-player-profile', 'analyze-positioning');
    console.log('✅ Registered core data retrieval tools');
  } catch (error) {
    console.error('❌ Failed to register core data retrieval tools:', error);
  }

  // Register screenshot tool
  try {
    registerScreenshotTool(toolManager);
    registeredTools.push('capture-screenshot');
    console.log('✅ Registered screenshot tool');
  } catch (error) {
    console.error('❌ Failed to register screenshot tool:', error);
  }

  // Setup event logging if requested
  if (enableEventLogging) {
    const eventTypes = [
      ToolManagerEvent.TOOL_REGISTERED,
      ToolManagerEvent.TOOL_UNREGISTERED,
      ToolManagerEvent.TOOL_EXECUTED,
      ToolManagerEvent.TOOL_FAILED,
      ToolManagerEvent.TOOL_ENABLED,
      ToolManagerEvent.TOOL_DISABLED
    ];

    eventTypes.forEach(eventType => {
      toolManager.addEventListener(eventType, (event: any) => {
        console.log(`[AI-TOOLS] ${event.type}: ${event.toolName}`, event.data || '');
      });
    });

    console.log('✅ Event logging enabled for AI tooling framework');
  }

  // Setup periodic health checks if interval is provided
  if (healthCheckInterval > 0) {
    setInterval(async () => {
      try {
        const healthStatus = await toolManager.healthCheck();
        const unhealthyTools = Object.entries(healthStatus)
          .filter(([_, health]) => !(health as { healthy: boolean }).healthy)
          .map(([name]) => name);

        if (unhealthyTools.length > 0) {
          console.warn(`[AI-TOOLS] Health check detected unhealthy tools: ${unhealthyTools.join(', ')}`);
        }
      } catch (error) {
        console.error('[AI-TOOLS] Health check failed:', error);
      }
    }, healthCheckInterval);

    console.log(`✅ Periodic health checks enabled (${healthCheckInterval}ms interval)`);
  }

  // Perform initial health check
  const healthStatus = await toolManager.healthCheck();

  console.log(`🚀 AI Tooling Framework initialized with ${registeredTools.length} tools`);

  return {
    toolManager,
    registeredTools,
    healthStatus
  };
}

// Helper function to create a simple tool
export function createSimpleTool<TInput = any, TOutput = any>(
  name: string,
  description: string,
  execute: (input: TInput) => Promise<TOutput>
): ISimpleTool<TInput, TOutput> {
  return {
    name,
    description,
    execute
  };
}

// Helper function to validate tool input
export function validateToolInput<T>(
  input: T,
  schema: Record<string, ToolParameterSchema>
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  for (const [key, paramSchema] of Object.entries(schema)) {
    const value = (input as any)[key];

    if (paramSchema.required && value === undefined) {
      errors.push(`Missing required parameter: ${key}`);
      continue;
    }

    if (value !== undefined && typeof value !== paramSchema.type) {
      errors.push(`Invalid type for parameter ${key}: expected ${paramSchema.type}, got ${typeof value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Default export for convenient importing
export default {
  ToolManager,
  toolManager,
  ToolCategory,
  ToolPriority,
  PlayerDataTool,
  AIToolingTest,
  initializeAITooling,
  createSimpleTool,
  validateToolInput,
  version: '1.0.0'
};