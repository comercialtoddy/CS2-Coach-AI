import fetch from 'node-fetch';

/**
 * OpenRouter API Configuration
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;

/**
 * OpenRouter model definitions
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

/**
 * OpenRouter API request body for chat completions
 */
export interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  response_format?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      schema: object;
      strict?: boolean;
    };
  };
  provider?: {
    order?: string[];
    ignore?: string[];
    require_parameters?: boolean;
  };
  models?: string[]; // Fallback models
}

/**
 * OpenRouter API response for chat completions
 */
export interface OpenRouterChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    code: string;
    message: string;
    type?: string;
  };
}

/**
 * OpenRouter error response
 */
export interface OpenRouterError {
  error: {
    code: string;
    message: string;
    type?: string;
    metadata?: any;
  };
}

/**
 * LLM Call options for simplified interface
 */
export interface LLMCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json' | 'json_schema';
  jsonSchema?: {
    name: string;
    schema: object;
  };
  fallbackModels?: string[];
  timeout?: number;
  retries?: number;
}

/**
 * Standardized LLM response
 */
export interface LLMResponse {
  success: boolean;
  content?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTimeMs: number;
    attempts: number;
    provider?: string;
  };
}

/**
 * Default models for different use cases
 */
export const DEFAULT_MODELS = {
  FAST: 'openai/gpt-4o-mini',
  BALANCED: 'openai/gpt-4o',
  SMART: 'anthropic/claude-3.5-sonnet',
  CREATIVE: 'openai/gpt-4o',
  REASONING: 'deepseek/deepseek-r1',
  CHEAP: 'meta-llama/llama-3.2-3b-instruct:free'
} as const;

/**
 * Check if OpenRouter API is properly configured
 * @returns {boolean} True if API key is available
 */
export function isOpenRouterConfigured(): boolean {
  return !!OPENROUTER_API_KEY && OPENROUTER_API_KEY !== '';
}

/**
 * Get OpenRouter configuration status
 * @returns {object} Configuration status and details
 */
export function getOpenRouterStatus(): {
  configured: boolean;
  apiKeyPresent: boolean;
  baseUrl: string;
} {
  return {
    configured: isOpenRouterConfigured(),
    apiKeyPresent: !!OPENROUTER_API_KEY,
    baseUrl: OPENROUTER_BASE_URL
  };
}

/**
 * Validate OpenRouter API key format
 * @param apiKey - The API key to validate
 * @returns {boolean} True if format appears valid
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  // OpenRouter API keys typically start with 'sk-or-v1-' and are 64+ characters
  return apiKey.startsWith('sk-or-v1-') && apiKey.length >= 40;
}

/**
 * Make a raw request to OpenRouter API with error handling and retries
 * @param endpoint - API endpoint (e.g., '/chat/completions')
 * @param body - Request body
 * @param options - Request options
 * @returns {Promise<any>} API response
 */
export async function makeOpenRouterRequest(
  endpoint: string,
  body: any,
  options: {
    timeout?: number;
    retries?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<any> {
  const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_MAX_RETRIES, headers = {} } = options;

  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
  }

  const url = `${OPENROUTER_BASE_URL}${endpoint}`;
  const requestHeaders = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://openhud.ai', // For OpenRouter analytics
    'X-Title': 'OpenHud AI Agent', // For OpenRouter analytics
    ...headers
  };

  let lastError: any;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        const error: OpenRouterError = responseData;
        throw new Error(
          `OpenRouter API error (${response.status}): ${error.error?.message || 'Unknown error'}`
        );
      }

      // Check for API-level errors in successful response
      if (responseData.error) {
        throw new Error(`OpenRouter API error: ${responseData.error.message}`);
      }

      return responseData;

    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('OpenRouter authentication failed. Check your API key.');
        }
        if (error.message.includes('429')) {
          throw new Error('OpenRouter rate limit exceeded. Please try again later.');
        }
      }

      // If this is the last attempt, throw the error
      if (attempt === retries + 1) {
        break;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `OpenRouter API request failed after ${retries + 1} attempts. Last error: ${
      lastError instanceof Error ? lastError.message : 'Unknown error'
    }`
  );
}

/**
 * Get list of available models from OpenRouter
 * @returns {Promise<OpenRouterModel[]>} List of available models
 */
export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await makeOpenRouterRequest('/models', {}, {
      timeout: 10000,
      retries: 2
    });

    return response.data || [];
  } catch (error) {
    console.error('Failed to fetch OpenRouter models:', error);
    throw new Error(`Failed to fetch available models: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Send a chat completion request to OpenRouter
 * @param request - Chat completion request
 * @param options - Request options
 * @returns {Promise<OpenRouterChatResponse>} Chat completion response
 */
export async function chatCompletion(
  request: OpenRouterChatRequest,
  options: {
    timeout?: number;
    retries?: number;
  } = {}
): Promise<OpenRouterChatResponse> {
  // Validate required fields
  if (!request.model) {
    throw new Error('Model is required for chat completion');
  }

  if (!request.messages || request.messages.length === 0) {
    throw new Error('Messages array is required and cannot be empty');
  }

  // Set defaults
  const requestBody: OpenRouterChatRequest = {
    ...request,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens ?? 1000
  };

  try {
    const response = await makeOpenRouterRequest('/chat/completions', requestBody, options);
    return response;
  } catch (error) {
    throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Simplified LLM call interface - high-level abstraction
 * @param prompt - The prompt to send to the LLM
 * @param options - LLM call options
 * @returns {Promise<LLMResponse>} Standardized response
 */
export async function callLLM(
  prompt: string,
  options: LLMCallOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const {
    model = DEFAULT_MODELS.BALANCED,
    temperature = 0.7,
    maxTokens = 1000,
    systemPrompt,
    responseFormat = 'text',
    jsonSchema,
    fallbackModels = [],
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_MAX_RETRIES
  } = options;

  // Build messages array
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  // Build request
  const request: OpenRouterChatRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  // Add response format if specified
  if (responseFormat === 'json_object') {
    request.response_format = { type: 'json_object' };
  } else if (responseFormat === 'json_schema' && jsonSchema) {
    request.response_format = {
      type: 'json_schema',
      json_schema: {
        name: jsonSchema.name,
        schema: jsonSchema.schema,
        strict: true
      }
    };
  }

  // Add fallback models if provided
  if (fallbackModels.length > 0) {
    request.models = fallbackModels;
  }

  let attempts = 0;
  let lastError: any;

  // Try primary model and fallbacks
  const modelsToTry = [model, ...fallbackModels];
  
  for (const currentModel of modelsToTry) {
    attempts++;
    
    try {
      const response = await chatCompletion(
        { ...request, model: currentModel },
        { timeout, retries: 0 } // Handle retries here instead of in chatCompletion
      );

      // Extract content
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      return {
        success: true,
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          attempts,
          provider: 'openrouter'
        }
      };

    } catch (error) {
      lastError = error;
      console.warn(`Model ${currentModel} failed (attempt ${attempts}):`, error instanceof Error ? error.message : error);
      
      // Continue to next model if available
      continue;
    }
  }

  // All models failed
  return {
    success: false,
    error: {
      code: 'LLM_CALL_FAILED',
      message: `All models failed after ${attempts} attempts`,
      details: {
        lastError: lastError instanceof Error ? lastError.message : lastError,
        attempts,
        modelsAttempted: modelsToTry
      }
    },
    metadata: {
      executionTimeMs: Date.now() - startTime,
      attempts,
      provider: 'openrouter'
    }
  };
}

/**
 * Test OpenRouter API connectivity
 * @returns {Promise<object>} Test result
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    if (!isOpenRouterConfigured()) {
      return {
        success: false,
        message: 'OpenRouter API key not configured'
      };
    }

    // Make a simple test call
    const response = await callLLM('Hello', {
      model: DEFAULT_MODELS.FAST,
      maxTokens: 10,
      timeout: 10000
    });

    if (response.success) {
      return {
        success: true,
        message: 'OpenRouter API connection successful',
        details: {
          model: response.model,
          usage: response.usage,
          executionTime: response.metadata?.executionTimeMs
        }
      };
    } else {
      return {
        success: false,
        message: 'OpenRouter API test failed',
        details: response.error
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'OpenRouter API connection test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
} 