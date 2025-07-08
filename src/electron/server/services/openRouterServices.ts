import fetch from 'node-fetch';
import { EventEmitter } from 'events';

/**
 * OpenRouter API Configuration
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 50;

// Event emitter for API key changes
const apiKeyEvents = new EventEmitter();

// Rate limiting state
let requestCount = 0;
let windowStart = Date.now();

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
 * OpenRouter API error response
 */
export interface OpenRouterError {
  error?: {
    message: string;
    type?: string;
    param?: string;
    code?: string;
  };
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  requestsThisWindow: number;
  windowStartTime: number;
  timeUntilReset: number;
  canMakeRequest: boolean;
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
 * Standardized LLM response format
 */
export interface StandardizedLLMResponse {
  success: boolean;
  content?: string;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    id: string;
    created: number;
    finishReason: string;
    executionTimeMs: number;
    provider: 'openrouter';
    attempts?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * OpenRouter chat completion message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenRouter chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  functions?: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }[];
  function_call?: 'auto' | 'none' | { name: string };
  stream?: boolean;
}

/**
 * OpenRouter chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'function_call' | null;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenRouter chat completion stream response
 */
export interface ChatCompletionStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: 'stop' | 'length' | 'function_call' | null;
  }[];
}

/**
 * Default models for different use cases
 */
export const DEFAULT_MODELS = {
  FAST: 'openai/gpt-3.5-turbo',
  BALANCED: 'anthropic/claude-2.1',
  SMART: 'anthropic/claude-3-sonnet-20240229',
  CREATIVE: 'meta-llama/llama-2-70b-chat',
  REASONING: 'google/gemini-pro',
  CHEAP: 'mistral/mistral-7b-instruct'
} as const;

/**
 * Check if OpenRouter API is properly configured
 * @returns {boolean} True if API key is available and valid
 */
export function isOpenRouterConfigured(): boolean {
  return validateApiKeyFormat(OPENROUTER_API_KEY);
}

/**
 * Get OpenRouter configuration status
 * @returns {object} Configuration status and details
 */
export function getOpenRouterStatus(): {
  configured: boolean;
  apiKeyPresent: boolean;
  baseUrl: string;
  rateLimits: RateLimitInfo;
} {
  return {
    configured: isOpenRouterConfigured(),
    apiKeyPresent: !!OPENROUTER_API_KEY,
    baseUrl: OPENROUTER_BASE_URL,
    rateLimits: getRateLimitInfo()
  };
}

/**
 * Validate OpenRouter API key format
 * @param apiKey - The API key to validate
 * @returns {boolean} True if format appears valid
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  if (!apiKey) return false;
  
  // OpenRouter API keys typically start with 'sk-or-v1-' and are 64+ characters
  const isValidFormat = apiKey.startsWith('sk-or-v1-') && apiKey.length >= 64;
  
  // Check for any suspicious characters that shouldn't be in an API key
  const hasSuspiciousChars = /[<>{}()\[\]\\\/]/.test(apiKey);
  
  return isValidFormat && !hasSuspiciousChars;
}

/**
 * Get current rate limit information
 * @returns {RateLimitInfo} Current rate limit status
 */
export function getRateLimitInfo(): RateLimitInfo {
  const now = Date.now();
  
  // Reset window if needed
  if (now - windowStart >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }
  
  return {
    requestsThisWindow: requestCount,
    windowStartTime: windowStart,
    timeUntilReset: Math.max(0, RATE_LIMIT_WINDOW - (now - windowStart)),
    canMakeRequest: requestCount < MAX_REQUESTS_PER_WINDOW
  };
}

/**
 * Record a new API request for rate limiting
 */
function recordRequest(): void {
  const now = Date.now();
  
  // Reset window if needed
  if (now - windowStart >= RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }
  
  requestCount++;
}

/**
 * Subscribe to API key changes
 * @param callback - Function to call when API key changes
 * @returns {function} Unsubscribe function
 */
export function onApiKeyChange(callback: (configured: boolean) => void): () => void {
  apiKeyEvents.on('change', callback);
  return () => apiKeyEvents.off('change', callback);
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

  const rateLimitInfo = getRateLimitInfo();
  if (!rateLimitInfo.canMakeRequest) {
    throw new Error(
      `Rate limit exceeded. Please wait ${Math.ceil(rateLimitInfo.timeUntilReset / 1000)} seconds.`
    );
  }

  const url = `${OPENROUTER_BASE_URL}${endpoint}`;
  const requestHeaders = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://cs2-coach-ai.toddyclipsgg.com',
    'X-Title': 'CS2 Coach AI by Toddyclipsgg',
    ...headers
  };

  let lastError: any;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      recordRequest();

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseData: any = await response.json();

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
 * Chat completion options
 */
export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  functions?: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  }[];
  functionCall?: 'auto' | 'none' | { name: string };
  stream?: boolean;
  signal?: AbortSignal;
    timeout?: number;
    retries?: number;
}

/**
 * Parse and validate a raw OpenRouter API response
 * @param response - Raw API response
 * @param startTime - Request start time for execution duration calculation
 * @returns {StandardizedLLMResponse} Standardized response
 */
export function parseOpenRouterResponse(
  response: ChatCompletionResponse,
  startTime: number
): StandardizedLLMResponse {
  try {
    // Basic validation
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format: response must be an object');
    }

    if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
      throw new Error('Invalid response format: missing or empty choices array');
    }

    const choice = response.choices[0];
    if (!choice.message) {
      throw new Error('Invalid response format: missing message in first choice');
    }

    // Extract function call if present
    let functionCall: StandardizedLLMResponse['functionCall'] | undefined;
    if (choice.message.function_call) {
      try {
        functionCall = {
          name: choice.message.function_call.name,
          arguments: JSON.parse(choice.message.function_call.arguments)
        };
      } catch (error) {
        console.warn('Failed to parse function call arguments:', error);
        functionCall = {
          name: choice.message.function_call.name,
          arguments: { raw: choice.message.function_call.arguments }
        };
      }
    }

    // Build standardized response
    const standardized: StandardizedLLMResponse = {
      success: true,
      content: choice.message.content || undefined,
      functionCall,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      metadata: {
        id: response.id,
        created: response.created,
        finishReason: choice.finish_reason || 'unknown',
        executionTimeMs: Date.now() - startTime,
        provider: 'openrouter'
      }
    };

    return standardized;

  } catch (error) {
    // Handle parsing errors
    return {
      success: false,
      model: response.model || 'unknown',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        id: response.id || '',
        created: response.created || Date.now(),
        finishReason: 'error',
        executionTimeMs: Date.now() - startTime,
        provider: 'openrouter'
      },
      error: {
        code: 'PARSE_ERROR',
        message: 'Failed to parse OpenRouter response',
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          rawResponse: response
        }
      }
    };
  }
}

/**
 * Parse and validate a streaming response chunk
 * @param chunk - Streaming response chunk
 * @returns {Partial<StandardizedLLMResponse>} Partial standardized response
 */
export function parseStreamingChunk(
  chunk: ChatCompletionStreamResponse
): Partial<StandardizedLLMResponse> {
  try {
    if (!chunk || !chunk.choices || chunk.choices.length === 0) {
      throw new Error('Invalid chunk format');
    }

    const choice = chunk.choices[0];
    const delta = choice.delta;
    const startTime = Date.now();

    const partial: Partial<StandardizedLLMResponse> = {
      success: true,
      metadata: {
        id: chunk.id,
        created: chunk.created,
        finishReason: choice.finish_reason || 'unknown',
        executionTimeMs: Date.now() - startTime,
        provider: 'openrouter'
      }
    };

    if (delta.content) {
      partial.content = delta.content;
  }

    if (delta.function_call) {
      partial.functionCall = {
        name: delta.function_call.name || '',
        arguments: {}
      };
      if (delta.function_call.arguments) {
        try {
          partial.functionCall.arguments = JSON.parse(delta.function_call.arguments);
        } catch {
          partial.functionCall.arguments = { raw: delta.function_call.arguments };
        }
      }
    }

    return partial;

  } catch (error) {
    const startTime = Date.now();
    return {
      success: false,
      metadata: {
        id: chunk.id || '',
        created: chunk.created || Date.now(),
        finishReason: 'error',
        executionTimeMs: Date.now() - startTime,
        provider: 'openrouter'
      },
      error: {
        code: 'PARSE_ERROR',
        message: 'Failed to parse streaming chunk',
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          rawChunk: chunk
        }
      }
    };
  }
}

/**
 * Validate and standardize error responses
 * @param error - Error object from OpenRouter
 * @param startTime - Request start time
 * @returns {StandardizedLLMResponse} Standardized error response
 */
export function standardizeError(
  error: unknown,
  startTime: number
): StandardizedLLMResponse {
  let errorCode = 'UNKNOWN_ERROR';
  let errorMessage = 'An unknown error occurred';
  let errorDetails: Record<string, any> = {};

  if (error instanceof Error) {
    errorMessage = error.message;
    
    // Extract error code from common patterns
    if (error.message.includes('401') || error.message.includes('403')) {
      errorCode = 'AUTHENTICATION_ERROR';
    } else if (error.message.includes('429')) {
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('timeout')) {
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('aborted')) {
      errorCode = 'REQUEST_ABORTED';
    }

    errorDetails = {
      name: error.name,
      stack: error.stack,
      cause: error.cause
    };
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, any>;
    if (errorObj.error?.message) {
      errorMessage = errorObj.error.message;
      errorCode = errorObj.error.code || errorObj.error.type || 'API_ERROR';
      errorDetails = { ...errorObj.error };
    }
  }

  return {
    success: false,
    model: 'unknown',
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    },
    metadata: {
      id: '',
      created: Date.now(),
      finishReason: 'error',
      executionTimeMs: Date.now() - startTime,
      provider: 'openrouter'
    },
    error: {
      code: errorCode,
      message: errorMessage,
      details: errorDetails
    }
  };
}

/**
 * Send a chat completion request to OpenRouter
 * @param messages - Array of chat messages
 * @param model - Model ID to use (see DEFAULT_MODELS)
 * @param options - Additional options for the request
 * @returns {Promise<StandardizedLLMResponse>} Chat completion response
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  model: string = DEFAULT_MODELS.BALANCED,
  options: ChatCompletionOptions = {}
): Promise<StandardizedLLMResponse> {
  const startTime = Date.now();
  
  try {
    const {
      temperature = 0.7,
      maxTokens,
      topP,
      frequencyPenalty,
      presencePenalty,
      stop,
      functions,
      functionCall,
      stream = false,
      signal,
      timeout = DEFAULT_TIMEOUT,
      retries = DEFAULT_MAX_RETRIES
    } = options;

    const requestBody: ChatCompletionRequest = {
      model,
      messages,
      temperature,
      stream
    };

    // Add optional parameters if provided
    if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;
    if (topP !== undefined) requestBody.top_p = topP;
    if (frequencyPenalty !== undefined) requestBody.frequency_penalty = frequencyPenalty;
    if (presencePenalty !== undefined) requestBody.presence_penalty = presencePenalty;
    if (stop !== undefined) requestBody.stop = stop;
    if (functions !== undefined) requestBody.functions = functions;
    if (functionCall !== undefined) requestBody.function_call = functionCall;

    if (stream) {
      const streamingResponse = await createStreamingChatCompletion(requestBody, { signal, timeout, retries });
      return parseOpenRouterResponse(streamingResponse, startTime);
    }

    const response = await makeOpenRouterRequest('/chat/completions', requestBody, {
      timeout,
      retries,
      headers: signal ? { 'X-Signal': signal.toString() } : {}
    }) as ChatCompletionResponse;

    return parseOpenRouterResponse(response, startTime);

  } catch (error) {
    return standardizeError(error, startTime);
  }
}

/**
 * Send a streaming chat completion request to OpenRouter
 * @param requestBody - Chat completion request body
 * @param options - Request options
 * @returns {Promise<ChatCompletionResponse>} Aggregated chat completion response
 */
async function createStreamingChatCompletion(
  requestBody: ChatCompletionRequest,
  options: { signal?: AbortSignal; timeout?: number; retries?: number }
): Promise<ChatCompletionResponse> {
  const { signal, timeout = DEFAULT_TIMEOUT, retries = DEFAULT_MAX_RETRIES } = options;

  if (!isOpenRouterConfigured()) {
    throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
  }

  const rateLimitInfo = getRateLimitInfo();
  if (!rateLimitInfo.canMakeRequest) {
    throw new Error(
      `Rate limit exceeded. Please wait ${Math.ceil(rateLimitInfo.timeUntilReset / 1000)} seconds.`
    );
  }

  const url = `${OPENROUTER_BASE_URL}/chat/completions`;
  const headers = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://cs2-coach-ai.toddyclipsgg.com',
    'X-Title': 'CS2 Coach AI by Toddyclipsgg',
    'Accept': 'text/event-stream'
  };

  let lastError: any;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      recordRequest();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...requestBody, stream: true }),
        signal: signal || controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json() as OpenRouterError;
        throw new Error(
          `OpenRouter API error (${response.status}): ${error.error?.message || 'Unknown error'}`
        );
      }

      if (!response.body) {
        throw new Error('No response body received from OpenRouter API');
      }

      const reader = (response.body as unknown as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: ChatCompletionResponse = {
        id: '',
        object: 'chat.completion',
        created: Date.now(),
        model: requestBody.model,
        choices: [],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const data: ChatCompletionStreamResponse = JSON.parse(line.slice(6));
              
              // Initialize result with first chunk's metadata
              if (!result.id) {
                result.id = data.id;
                result.created = data.created;
                result.model = data.model;
              }

              // Process the delta
              for (const choice of data.choices) {
                if (!result.choices[choice.index]) {
                  result.choices[choice.index] = {
                    index: choice.index,
                    message: {
                      role: 'assistant',
                      content: ''
                    },
                    finish_reason: null
                  };
                }

                const currentChoice = result.choices[choice.index];
                
                if (choice.delta.content) {
                  currentChoice.message.content += choice.delta.content;
                }
                
                if (choice.delta.function_call) {
                  if (!currentChoice.message.function_call) {
                    currentChoice.message.function_call = {
                      name: '',
                      arguments: ''
                    };
                  }
                  if (choice.delta.function_call.name) {
                    currentChoice.message.function_call.name = choice.delta.function_call.name;
                  }
                  if (choice.delta.function_call.arguments) {
                    currentChoice.message.function_call.arguments += choice.delta.function_call.arguments;
                  }
                }

                if (choice.finish_reason) {
                  currentChoice.finish_reason = choice.finish_reason;
                }
              }
            } catch (error) {
              console.error('Error parsing streaming response:', error);
              continue;
            }
          }
        }
      }

      return result;

    } catch (error) {
      lastError = error;
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('OpenRouter authentication failed. Check your API key.');
        }
        if (error.message.includes('429')) {
          throw new Error('OpenRouter rate limit exceeded. Please try again later.');
        }
        if (error.name === 'AbortError') {
          throw new Error('Request aborted: ' + error.message);
        }
      }

      if (attempt === retries + 1) {
        break;
  }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `OpenRouter streaming request failed after ${retries + 1} attempts. Last error: ${
      lastError instanceof Error ? lastError.message : 'Unknown error'
    }`
  );
}

/**
 * Simplified LLM call interface - high-level abstraction
 * @param prompt - The prompt to send to the LLM
 * @param options - LLM call options
 * @returns {Promise<StandardizedLLMResponse>} Standardized response
 */
export async function callLLM(
  prompt: string,
  options: LLMCallOptions = {}
): Promise<StandardizedLLMResponse> {
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

  let attempts = 0;
  let lastError: any;

  // Try primary model and fallbacks
  const modelsToTry = [model, ...fallbackModels];
  
  for (const currentModel of modelsToTry) {
    attempts++;
    
    try {
      const response = await createChatCompletion(
        messages,
        currentModel,
        {
          temperature,
          maxTokens,
          timeout,
          retries: 0 // Handle retries here instead of in createChatCompletion
        }
      );

      if (!response.success) {
        lastError = response.error;
        continue;
      }

      return {
        ...response,
        metadata: {
          ...response.metadata,
          attempts
        }
      };

    } catch (error) {
      lastError = error;
      console.warn(`Model ${currentModel} failed (attempt ${attempts}):`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  // All models failed
  return standardizeError({
    error: {
      code: 'ALL_MODELS_FAILED',
      message: `All models failed after ${attempts} attempts`,
      details: {
        lastError,
        attempts,
        modelsAttempted: modelsToTry
      }
    }
  }, startTime);
}

/**
 * Test OpenRouter API connectivity
 * @returns {Promise<{success: boolean; error?: string}>} Test results
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}> {
  try {
    if (!isOpenRouterConfigured()) {
      return {
        success: false,
        error: 'OpenRouter API not configured',
        details: {
          configured: false,
          reason: 'missing_or_invalid_api_key'
        }
      };
    }

    const rateLimitInfo = getRateLimitInfo();
    if (!rateLimitInfo.canMakeRequest) {
      return {
        success: false,
        error: `Rate limit exceeded. Please wait ${Math.ceil(rateLimitInfo.timeUntilReset / 1000)} seconds.`,
        details: rateLimitInfo
      };
    }

    // Make a minimal API call to test connectivity
    await makeOpenRouterRequest('/models', {}, { timeout: 5000, retries: 1 });

    return {
      success: true,
      details: {
        configured: true,
        rateLimitInfo,
        lastTest: new Date().toISOString()
      }
      };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: {
        configured: isOpenRouterConfigured(),
        rateLimitInfo: getRateLimitInfo(),
        lastTest: new Date().toISOString()
      }
    };
  }
} 