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

export {
  ToolCategory,
  ToolPriority,
  ToolManager,
  toolManager,
  ToolManagerEvent,
  PlayerDataTool,
  AIToolingTest
};

/**
 * Framework version information
 */
export const AI_TOOLING_VERSION = {
  version: '1.0.0',
  name: 'OpenHud AI Tooling Framework',
  description: 'Extensible framework for AI agent tools',
  author: 'OpenHud AI System',
  lastUpdated: new Date('2024-01-01')
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

/**
 * Helper function to create a simple tool from a function
 * Useful for quickly converting existing functions into tools
 * 
 * @param config - Tool configuration
 * @returns Simple tool implementation
 */
export function createSimpleTool<TInput, TOutput>(config: {
  name: string;
  description: string;
  category?: ToolCategory;
  tags?: string[];
  execute: (input: TInput) => Promise<TOutput>;
  inputExample?: TInput;
  outputExample?: TOutput;
}): ISimpleTool<TInput, TOutput> {
  const {
    name,
    description,
    category = ToolCategory.UTILITY,
    tags = [],
    execute,
    inputExample,
    outputExample
  } = config;

  return {
    name,
    description,
    inputSchema: {}, // Simple tools don't require complex schemas
    outputExample: outputExample || {} as TOutput,
    metadata: {
      version: '1.0.0',
      category,
      tags,
      author: 'OpenHud AI System',
      lastUpdated: new Date(),
      experimental: false,
      deprecated: false
    },
    execute
  };
}

/**
 * Utility function to validate tool input against a schema
 * Can be used by tools that implement custom validation logic
 * 
 * @param input - Input to validate
 * @param schema - Schema to validate against
 * @returns Validation result
 */
export function validateToolInput(
  input: any,
  schema: Record<string, ToolParameterSchema>
): {
  isValid: boolean;
  errors?: Array<{
    parameter: string;
    message: string;
    receivedType?: string;
    expectedType?: string;
  }>;
} {
  const errors: Array<{
    parameter: string;
    message: string;
    receivedType?: string;
    expectedType?: string;
  }> = [];

  // Check each schema parameter
  for (const [paramName, paramSchema] of Object.entries(schema)) {
    const value = input[paramName];
    const isRequired = paramSchema.required || false;
    const expectedType = paramSchema.type;

    // Check if required parameter is missing
    if (isRequired && (value === undefined || value === null)) {
      errors.push({
        parameter: paramName,
        message: `Required parameter '${paramName}' is missing`,
        receivedType: typeof value,
        expectedType
      });
      continue;
    }

    // Skip validation for optional missing parameters
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== expectedType) {
      errors.push({
        parameter: paramName,
        message: `Parameter '${paramName}' has incorrect type`,
        receivedType: actualType,
        expectedType
      });
      continue;
    }

    // Enum validation
    if (paramSchema.enum && !paramSchema.enum.includes(value)) {
      errors.push({
        parameter: paramName,
        message: `Parameter '${paramName}' must be one of: ${paramSchema.enum.join(', ')}`,
        receivedType: actualType,
        expectedType: `enum(${paramSchema.enum.join('|')})`
      });
    }

    // Object property validation (recursive)
    if (expectedType === 'object' && paramSchema.properties) {
      const nestedValidation = validateToolInput(value, paramSchema.properties);
      if (!nestedValidation.isValid && nestedValidation.errors) {
        nestedValidation.errors.forEach(error => {
          errors.push({
            ...error,
            parameter: `${paramName}.${error.parameter}`
          });
        });
      }
    }

    // Array item validation
    if (expectedType === 'array' && paramSchema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemValidation = validateToolInput({ item }, { item: paramSchema.items! });
        if (!itemValidation.isValid && itemValidation.errors) {
          itemValidation.errors.forEach(error => {
            errors.push({
              ...error,
              parameter: `${paramName}[${index}]`
            });
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Default export for convenient importing
 */
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
  version: AI_TOOLING_VERSION
};