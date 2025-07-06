import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { callLLM, LLMCallOptions, LLMResponse, DEFAULT_MODELS, isOpenRouterConfigured } from '../../services/openRouterServices.js';

/**
 * Input interface for the CallLLMTool
 */
export interface CallLLMToolInput {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: {
    name: string;
    schema: object;
  };
  fallbackModels?: string[];
  timeout?: number;
}

/**
 * Output interface for the CallLLMTool
 */
export interface CallLLMToolOutput {
  success: boolean;
  content?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost?: number; // In USD
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTimeMs: number;
    attempts: number;
    provider: string;
    originalPrompt?: string;
  };
}

/**
 * AI tool for making Large Language Model (LLM) calls through OpenRouter
 * 
 * This tool provides access to various LLMs (GPT-4, Claude, Gemini, etc.) through the OpenRouter API.
 * It supports structured outputs, model fallbacks, and comprehensive error handling.
 * This is the core tool for AI reasoning and text generation in the system.
 */
export class CallLLMTool implements ITool<CallLLMToolInput, CallLLMToolOutput> {
  public readonly name = 'call-llm';
  
  public readonly description = 
    'Makes calls to Large Language Models (LLMs) such as GPT-4, Claude, Gemini, and others through OpenRouter. ' +
    'Supports structured outputs (JSON), custom system prompts, model selection, and automatic fallbacks. ' +
    'This is the primary tool for AI reasoning, text generation, analysis, and conversation in the system.';

  public readonly inputSchema: Record<string, ToolParameterSchema> = {
    prompt: {
      type: 'string',
      description: 'The main prompt/query to send to the LLM. This should be clear and specific.',
      required: true
    },
    systemPrompt: {
      type: 'string',
      description: 'Optional system prompt to set the context and behavior of the LLM',
      required: false
    },
    model: {
      type: 'string',
      description: 'LLM model to use. Defaults to a balanced model. Examples: "openai/gpt-4o", "anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"',
      required: false,
      default: DEFAULT_MODELS.BALANCED
    },
    temperature: {
      type: 'number',
      description: 'Controls randomness in responses (0.0-2.0). Lower values are more deterministic, higher values more creative.',
      required: false,
      default: 0.7
    },
    maxTokens: {
      type: 'number',
      description: 'Maximum number of tokens to generate in the response',
      required: false,
      default: 1000
    },
    responseFormat: {
      type: 'string',
      description: 'Expected response format: "text" for plain text, "json" for JSON object, "json_schema" for structured JSON',
      required: false,
      enum: ['text', 'json', 'json_schema'],
      default: 'text'
    },
    jsonSchema: {
      type: 'object',
      description: 'JSON schema definition when responseFormat is "json_schema". Should include name and schema properties.',
      required: false,
      properties: {
        name: { type: 'string', description: 'Name of the schema' },
        schema: { type: 'object', description: 'JSON schema object defining the expected structure' }
      }
    },
    fallbackModels: {
      type: 'array',
      description: 'Array of fallback model names to try if the primary model fails',
      required: false,
      items: { type: 'string', description: 'Model name' }
    },
    timeout: {
      type: 'number',
      description: 'Request timeout in milliseconds',
      required: false,
      default: 30000
    }
  };

  public readonly outputExample: CallLLMToolOutput = {
    success: true,
    content: 'This is an example response from the LLM. The content will vary based on your prompt and the selected model.',
    model: 'openai/gpt-4o',
    usage: {
      promptTokens: 25,
      completionTokens: 150,
      totalTokens: 175,
      estimatedCost: 0.001
    },
    metadata: {
      executionTimeMs: 2340,
      attempts: 1,
      provider: 'openrouter',
      originalPrompt: 'Example prompt'
    }
  };

  public readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.EXTERNAL_API,
    tags: ['llm', 'ai', 'openrouter', 'gpt', 'claude', 'reasoning', 'text-generation'],
    author: 'OpenHud AI System',
    lastUpdated: new Date(),
    experimental: false,
    deprecated: false
  };

  /**
   * Validates input parameters for the LLM call
   */
  public validateInput(input: CallLLMToolInput): {
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

    // Validate prompt (required)
    if (!input.prompt || typeof input.prompt !== 'string') {
      errors.push({
        parameter: 'prompt',
        message: 'prompt is required and must be a non-empty string',
        receivedType: typeof input.prompt,
        expectedType: 'string'
      });
    } else if (input.prompt.trim().length === 0) {
      errors.push({
        parameter: 'prompt',
        message: 'prompt cannot be empty or only whitespace',
        receivedType: 'empty string',
        expectedType: 'non-empty string'
      });
    }

    // Validate systemPrompt (optional)
    if (input.systemPrompt !== undefined && typeof input.systemPrompt !== 'string') {
      errors.push({
        parameter: 'systemPrompt',
        message: 'systemPrompt must be a string',
        receivedType: typeof input.systemPrompt,
        expectedType: 'string'
      });
    }

    // Validate model (optional)
    if (input.model !== undefined && typeof input.model !== 'string') {
      errors.push({
        parameter: 'model',
        message: 'model must be a string',
        receivedType: typeof input.model,
        expectedType: 'string'
      });
    }

    // Validate temperature (optional)
    if (input.temperature !== undefined) {
      if (typeof input.temperature !== 'number') {
        errors.push({
          parameter: 'temperature',
          message: 'temperature must be a number',
          receivedType: typeof input.temperature,
          expectedType: 'number'
        });
      } else if (input.temperature < 0 || input.temperature > 2) {
        errors.push({
          parameter: 'temperature',
          message: 'temperature must be between 0.0 and 2.0',
          receivedType: `${input.temperature}`,
          expectedType: 'number between 0.0 and 2.0'
        });
      }
    }

    // Validate maxTokens (optional)
    if (input.maxTokens !== undefined) {
      if (typeof input.maxTokens !== 'number') {
        errors.push({
          parameter: 'maxTokens',
          message: 'maxTokens must be a number',
          receivedType: typeof input.maxTokens,
          expectedType: 'number'
        });
      } else if (!Number.isInteger(input.maxTokens) || input.maxTokens <= 0) {
        errors.push({
          parameter: 'maxTokens',
          message: 'maxTokens must be a positive integer',
          receivedType: `${input.maxTokens}`,
          expectedType: 'positive integer'
        });
      }
    }

    // Validate responseFormat (optional)
    if (input.responseFormat !== undefined) {
      const validFormats = ['text', 'json', 'json_schema'];
      if (!validFormats.includes(input.responseFormat)) {
        errors.push({
          parameter: 'responseFormat',
          message: `responseFormat must be one of: ${validFormats.join(', ')}`,
          receivedType: input.responseFormat,
          expectedType: validFormats.join(' | ')
        });
      }
    }

    // Validate jsonSchema (required if responseFormat is 'json_schema')
    if (input.responseFormat === 'json_schema') {
      if (!input.jsonSchema) {
        errors.push({
          parameter: 'jsonSchema',
          message: 'jsonSchema is required when responseFormat is "json_schema"',
          receivedType: 'undefined',
          expectedType: 'object'
        });
      } else if (typeof input.jsonSchema !== 'object') {
        errors.push({
          parameter: 'jsonSchema',
          message: 'jsonSchema must be an object',
          receivedType: typeof input.jsonSchema,
          expectedType: 'object'
        });
      } else {
        if (!input.jsonSchema.name || typeof input.jsonSchema.name !== 'string') {
          errors.push({
            parameter: 'jsonSchema.name',
            message: 'jsonSchema.name is required and must be a string',
            receivedType: typeof input.jsonSchema.name,
            expectedType: 'string'
          });
        }
        if (!input.jsonSchema.schema || typeof input.jsonSchema.schema !== 'object') {
          errors.push({
            parameter: 'jsonSchema.schema',
            message: 'jsonSchema.schema is required and must be an object',
            receivedType: typeof input.jsonSchema.schema,
            expectedType: 'object'
          });
        }
      }
    }

    // Validate fallbackModels (optional)
    if (input.fallbackModels !== undefined) {
      if (!Array.isArray(input.fallbackModels)) {
        errors.push({
          parameter: 'fallbackModels',
          message: 'fallbackModels must be an array',
          receivedType: typeof input.fallbackModels,
          expectedType: 'array'
        });
      } else {
        input.fallbackModels.forEach((model, index) => {
          if (typeof model !== 'string') {
            errors.push({
              parameter: `fallbackModels[${index}]`,
              message: 'Each fallback model must be a string',
              receivedType: typeof model,
              expectedType: 'string'
            });
          }
        });
      }
    }

    // Validate timeout (optional)
    if (input.timeout !== undefined) {
      if (typeof input.timeout !== 'number') {
        errors.push({
          parameter: 'timeout',
          message: 'timeout must be a number',
          receivedType: typeof input.timeout,
          expectedType: 'number'
        });
      } else if (!Number.isInteger(input.timeout) || input.timeout <= 0) {
        errors.push({
          parameter: 'timeout',
          message: 'timeout must be a positive integer (milliseconds)',
          receivedType: `${input.timeout}`,
          expectedType: 'positive integer'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Executes the LLM call using OpenRouter
   */
  public async execute(
    input: CallLLMToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CallLLMToolOutput>> {
    const startTime = Date.now();
    
    try {
      // Build LLM call options
      const options: LLMCallOptions = {
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        systemPrompt: input.systemPrompt,
        responseFormat: input.responseFormat,
        jsonSchema: input.jsonSchema,
        fallbackModels: input.fallbackModels,
        timeout: input.timeout
      };

      // Make the LLM call
      const response: LLMResponse = await callLLM(input.prompt, options);

      // Calculate estimated cost (rough approximation)
      const estimatedCost = response.usage ? this.calculateEstimatedCost(response.usage, response.model) : undefined;

      // Prepare output
      const output: CallLLMToolOutput = {
        success: response.success,
        content: response.content,
        model: response.model,
        usage: response.usage ? {
          ...response.usage,
          estimatedCost
        } : undefined,
        error: response.error,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          attempts: response.metadata?.attempts || 1,
          provider: response.metadata?.provider || 'openrouter',
          originalPrompt: input.prompt.length > 100 ? input.prompt.substring(0, 100) + '...' : input.prompt
        }
      };

      return {
        success: response.success,
        data: output,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: this.name,
          cached: false,
          requestId: context.requestId,
          modelUsed: response.model,
          tokenUsage: response.usage?.totalTokens
        }
      };

    } catch (error) {
      const output: CallLLMToolOutput = {
        success: false,
        error: {
          code: 'LLM_EXECUTION_ERROR',
          message: 'Failed to execute LLM call',
          details: {
            originalError: error instanceof Error ? error.message : 'Unknown error',
            prompt: input.prompt.length > 100 ? input.prompt.substring(0, 100) + '...' : input.prompt,
            model: input.model,
            stackTrace: error instanceof Error ? error.stack : undefined
          }
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          attempts: 1,
          provider: 'openrouter',
          originalPrompt: input.prompt.length > 100 ? input.prompt.substring(0, 100) + '...' : input.prompt
        }
      };

      return {
        success: false,
        data: output,
        error: {
          code: 'LLM_EXECUTION_ERROR',
          message: 'LLM call failed due to execution error',
          details: {
            originalError: error instanceof Error ? error.message : 'Unknown error',
            input: { ...input, prompt: input.prompt.length > 100 ? input.prompt.substring(0, 100) + '...' : input.prompt }
          }
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: this.name,
          cached: false
        }
      };
    }
  }

  /**
   * Calculate rough estimated cost based on usage and model
   * @param usage Token usage information
   * @param model Model name (optional)
   * @returns Estimated cost in USD
   */
  private calculateEstimatedCost(usage: { promptTokens: number; completionTokens: number }, model?: string): number {
    // Rough cost estimates (per 1M tokens) - these should be updated with real pricing
    const costEstimates: Record<string, { input: number; output: number }> = {
      'openai/gpt-4o': { input: 2.50, output: 10.00 },
      'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
      'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
      'anthropic/claude-3.5-haiku': { input: 0.25, output: 1.25 },
      'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
      'meta-llama/llama-3.2-3b-instruct:free': { input: 0, output: 0 }
    };

    const pricing = costEstimates[model || ''] || { input: 1.0, output: 5.0 }; // Default fallback
    
    const inputCost = (usage.promptTokens / 1000000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000000) * pricing.output;
    
    return Math.round((inputCost + outputCost) * 100000) / 100000; // Round to 5 decimal places
  }

  /**
   * Health check to verify OpenRouter connectivity and configuration
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      // Check if OpenRouter is configured
      if (!isOpenRouterConfigured()) {
        return {
          healthy: false,
          message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.',
          details: {
            configured: false,
            timestamp: new Date()
          }
        };
      }

      // Test a simple LLM call
      const testResponse = await callLLM('Test connectivity', {
        model: DEFAULT_MODELS.FAST,
        maxTokens: 5,
        timeout: 10000
      });

      if (testResponse.success) {
        return {
          healthy: true,
          message: 'OpenRouter LLM calls are working properly',
          details: {
            configured: true,
            testModel: testResponse.model,
            responseTime: testResponse.metadata?.executionTimeMs,
            testContent: testResponse.content?.substring(0, 50),
            timestamp: new Date()
          }
        };
      } else {
        return {
          healthy: false,
          message: 'OpenRouter LLM test call failed',
          details: {
            configured: true,
            error: testResponse.error,
            timestamp: new Date()
          }
        };
      }
    } catch (error) {
      return {
        healthy: false,
        message: 'OpenRouter health check failed with exception',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Cleanup method (no persistent resources to clean up)
   */
  public async dispose(): Promise<void> {
    console.log(`CallLLMTool '${this.name}' disposed successfully`);
  }
} 