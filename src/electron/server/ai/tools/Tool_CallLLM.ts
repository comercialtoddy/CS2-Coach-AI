import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata } from '../interfaces/ITool.js';
import { callLLM } from '../../services/openRouterServices.js';

interface CallLLMInput {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CallLLMOutput {
  response: string;
}

/**
 * Tool for making LLM API calls
 */
export class Tool_CallLLM implements ITool<CallLLMInput, CallLLMOutput> {
  public name = 'Tool_CallLLM';
  public description = 'Makes API calls to language models via OpenRouter';

  public inputSchema: Record<string, ToolParameterSchema> = {
    prompt: {
      type: 'string',
      description: 'The prompt to send to the LLM',
      required: true
    },
    model: {
      type: 'string',
      description: 'The model ID to use (e.g., anthropic/claude-2)',
      required: true
    },
    temperature: {
      type: 'number',
      description: 'Sampling temperature (0-1)',
      required: false
    },
    maxTokens: {
      type: 'number',
      description: 'Maximum tokens to generate',
      required: false
    }
  };

  public outputExample: CallLLMOutput = {
    response: 'This is a sample response from the LLM.'
  };

  public metadata: ToolMetadata = {
    version: '1.0.0',
    category: 'llm',
    tags: ['llm', 'openrouter', 'api']
  };

  public validateInput(input: CallLLMInput): { isValid: boolean; errors?: { parameter: string; message: string; receivedType?: string; expectedType?: string; }[] } {
    const errors = [];

    if (typeof input.prompt !== 'string') {
      errors.push({
        parameter: 'prompt',
        message: 'Prompt must be a string',
        receivedType: typeof input.prompt,
        expectedType: 'string'
      });
    }

    if (typeof input.model !== 'string') {
      errors.push({
        parameter: 'model',
        message: 'Model must be a string',
        receivedType: typeof input.model,
        expectedType: 'string'
      });
    }

    if (input.temperature !== undefined && typeof input.temperature !== 'number') {
      errors.push({
        parameter: 'temperature',
        message: 'Temperature must be a number',
        receivedType: typeof input.temperature,
        expectedType: 'number'
      });
    }

    if (input.maxTokens !== undefined && typeof input.maxTokens !== 'number') {
      errors.push({
        parameter: 'maxTokens',
        message: 'Max tokens must be a number',
        receivedType: typeof input.maxTokens,
        expectedType: 'number'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  public async execute(
    input: CallLLMInput,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CallLLMOutput>> {
    try {
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input parameters',
            details: validation.errors
          }
        };
      }

      // Use the real OpenRouter service to make the LLM call
      const response = await callLLM(input.prompt, {
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        timeout: 30000, // 30 seconds timeout
        retries: 2 // Retry twice on failure
      });

      if (!response.success) {
        return {
          success: false,
          error: {
            code: response.error?.code || 'LLM_ERROR',
            message: response.error?.message || 'Failed to get LLM response',
            details: response.error?.details
          }
        };
      }

      return {
        success: true,
        data: {
          response: response.content || 'No content returned from LLM'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LLM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }
} 