import { Request, Response } from 'express';
import { 
  callLLM, 
  getAvailableModels, 
  testConnection, 
  isOpenRouterConfigured, 
  getOpenRouterStatus,
  DEFAULT_MODELS,
  LLMCallOptions,
  // Novas importações
  getEnhancedModels,
  getRecommendedModels,
  getDynamicDefaultModels,
  clearModelCache,
  getCacheStatus,
  ModelFilters,
  EnhancedOpenRouterModel
} from '../services/openRouterServices.js';
import { CallLLMTool } from '../ai/tools/CallLLMTool.js';
import { ToolManager } from '../ai/ToolManager.js';

/**
 * Get OpenRouter service status and configuration
 */
export const getStatus = async (req: Request, res: Response) => {
  try {
    const status = getOpenRouterStatus();
    const testResult = status.configured ? await testConnection() : null;
    const cacheStatus = getCacheStatus();
    const dynamicModels = await getDynamicDefaultModels();

    res.json({
      success: true,
      data: {
        ...status,
        availableModels: Object.keys(DEFAULT_MODELS),
        defaultModels: DEFAULT_MODELS,
        dynamicModels,
        cache: cacheStatus,
        healthCheck: testResult
      }
    });
  } catch (error) {
    console.error('Error getting OpenRouter status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenRouter status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Test OpenRouter API connectivity
 */
export const testConnectionEndpoint = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const result = await testConnection();
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Error testing OpenRouter connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get list of available models from OpenRouter (raw models)
 */
export const getModels = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const models = await getAvailableModels();
    
    res.json({
      success: true,
      data: {
        models,
        count: models.length,
        defaultModels: DEFAULT_MODELS
      }
    });
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get enhanced models with filtering and caching
 */
export const getEnhancedModelsEndpoint = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const filters: ModelFilters = {
      category: req.query.category as string,
      maxCostPerMToken: req.query.maxCostPerMToken ? parseFloat(req.query.maxCostPerMToken as string) : undefined,
      minContextLength: req.query.minContextLength ? parseInt(req.query.minContextLength as string) : undefined,
      supportsStructuredOutputs: req.query.supportsStructuredOutputs === 'true',
      supportsToolCalling: req.query.supportsToolCalling === 'true',
      supportsImages: req.query.supportsImages === 'true',
      quality: req.query.quality ? (req.query.quality as string).split(',') as ('low' | 'medium' | 'high' | 'premium')[] : undefined,
      providers: req.query.providers ? (req.query.providers as string).split(',') : undefined,
      sortBy: req.query.sortBy as 'cost' | 'speed' | 'intelligence' | 'context_length' | 'name',
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };

    const result = await getEnhancedModels(filters);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching enhanced models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get recommended models for specific use cases
 */
export const getRecommendedModelsEndpoint = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const useCase = req.params.useCase as 'coding' | 'writing' | 'analysis' | 'chat' | 'reasoning' | 'cheap' | 'fast';
    
    if (!['coding', 'writing', 'analysis', 'chat', 'reasoning', 'cheap', 'fast'].includes(useCase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid use case. Must be one of: coding, writing, analysis, chat, reasoning, cheap, fast'
      });
    }

    const models = await getRecommendedModels(useCase);
    
    res.json({
      success: true,
      data: {
        useCase,
        models,
        count: models.length
      }
    });
  } catch (error) {
    console.error('Error fetching recommended models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommended models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get dynamic default models (replacement for static DEFAULT_MODELS)
 */
export const getDynamicDefaultModelsEndpoint = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const dynamicModels = await getDynamicDefaultModels();
    
    res.json({
      success: true,
      data: {
        dynamicModels,
        staticModels: DEFAULT_MODELS,
        cacheStatus: getCacheStatus()
      }
    });
  } catch (error) {
    console.error('Error fetching dynamic default models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dynamic default models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Clear model cache
 */
export const clearModelCacheEndpoint = async (req: Request, res: Response) => {
  try {
    clearModelCache();
    
    res.json({
      success: true,
      message: 'Model cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing model cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear model cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get cache status
 */
export const getCacheStatusEndpoint = async (req: Request, res: Response) => {
  try {
    const cacheStatus = getCacheStatus();
    
    res.json({
      success: true,
      data: cacheStatus
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Make a simple LLM call (direct service interface)
 */
export const simpleLLMCall = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const { prompt, options = {} } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required and must be a string'
      });
    }

    const result = await callLLM(prompt, options as LLMCallOptions);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    console.error('Error making LLM call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to make LLM call',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Make an LLM call using the AI Tool framework (enhanced interface)
 */
export const toolLLMCall = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const toolInput = req.body;

    // Create tool instance
    const llmTool = new CallLLMTool();

    // Validate input
    const validation = llmTool.validateInput(toolInput);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input parameters',
        details: validation.errors
      });
    }

    // Execute tool
    const context = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      metadata: {
        source: 'rest-api',
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    };

    const result = await llmTool.execute(toolInput, context);
    
    res.json({
      success: result.success,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error executing LLM tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute LLM tool',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get LLM tool information and schema
 */
export const getToolInfo = async (req: Request, res: Response) => {
  try {
    const llmTool = new CallLLMTool();
    
    res.json({
      success: true,
      data: {
        name: llmTool.name,
        description: llmTool.description,
        inputSchema: llmTool.inputSchema,
        outputExample: llmTool.outputExample,
        metadata: llmTool.metadata
      }
    });
  } catch (error) {
    console.error('Error getting tool info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tool information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Register the CallLLMTool with the ToolManager (for tool framework integration)
 */
export const registerTool = async (req: Request, res: Response) => {
  try {
    const toolManager = new ToolManager();
    const llmTool = new CallLLMTool();
    
    const success = toolManager.register(llmTool, {
      override: true, // Allow overriding if already registered
      enabled: true
    });

    if (success) {
      res.json({
        success: true,
        message: 'CallLLMTool registered successfully',
        data: {
          toolName: llmTool.name,
          registeredTools: toolManager.getTools()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to register CallLLMTool'
      });
    }
  } catch (error) {
    console.error('Error registering LLM tool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register tool',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Execute LLM tool via ToolManager (demonstrates tool manager integration)
 */
export const executeViaToolManager = async (req: Request, res: Response) => {
  try {
    if (!isOpenRouterConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API not configured. Please set OPENROUTER_API_KEY environment variable.'
      });
    }

    const toolInput = req.body;
    const toolManager = new ToolManager();
    
    // Register tool if not already registered
    const llmTool = new CallLLMTool();
    toolManager.register(llmTool, { override: true, enabled: true });

    // Execute via tool manager
    const result = await toolManager.execute('call-llm', toolInput, {
      timeout: 60000,
      metadata: {
        source: 'rest-api-tool-manager',
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.json({
      success: result.success,
      data: result.data,
      metadata: result.metadata,
      error: result.error
    });
  } catch (error) {
    console.error('Error executing via tool manager:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute via tool manager',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get examples of how to use the LLM API
 */
export const getExamples = async (req: Request, res: Response) => {
  try {
    const dynamicModels = await getDynamicDefaultModels();
    
    const examples = {
      basicCall: {
        endpoint: 'POST /openrouter/call',
        description: 'Simple LLM call with just a prompt',
        body: {
          prompt: 'Explain quantum computing in simple terms',
          options: {
            model: dynamicModels.BALANCED,
            maxTokens: 200,
            temperature: 0.7
          }
        }
      },
      structuredOutput: {
        endpoint: 'POST /openrouter/tool/call',
        description: 'LLM call with structured JSON output',
        body: {
          prompt: 'Analyze the sentiment of this text: "I love this product!"',
          responseFormat: 'json_schema',
          jsonSchema: {
            name: 'sentiment_analysis',
            schema: {
              type: 'object',
              properties: {
                sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reasoning: { type: 'string' }
              },
              required: ['sentiment', 'confidence', 'reasoning'],
              additionalProperties: false
            }
          }
        }
      },
      withSystemPrompt: {
        endpoint: 'POST /openrouter/tool/call',
        description: 'LLM call with system prompt and fallback models',
        body: {
          prompt: 'Write a haiku about programming',
          systemPrompt: 'You are a creative poet who specializes in haiku. Follow the 5-7-5 syllable pattern.',
          model: dynamicModels.CREATIVE,
          fallbackModels: [dynamicModels.BALANCED, dynamicModels.FAST],
          temperature: 0.9,
          maxTokens: 100
        }
      },
      recommendedModels: {
        endpoint: 'GET /openrouter/recommendations/coding',
        description: 'Get recommended models for coding tasks',
        response: 'Returns top 5 models optimized for coding with structured outputs support'
      },
      enhancedModels: {
        endpoint: 'GET /openrouter/models/enhanced',
        description: 'Get enhanced models with filtering and categorization',
        queryParams: {
          category: 'smart',
          supportsStructuredOutputs: 'true',
          sortBy: 'intelligence',
          limit: '10'
        }
      },
      dynamicDefaults: {
        endpoint: 'GET /openrouter/models/dynamic-defaults',
        description: 'Get current dynamic default models (updated automatically)',
        response: 'Returns dynamically selected best models for each category'
      }
    };

    res.json({
      success: true,
      data: {
        examples,
        availableModels: dynamicModels,
        staticModels: DEFAULT_MODELS,
        endpoints: {
          status: 'GET /openrouter/status',
          test: 'GET /openrouter/test',
          models: 'GET /openrouter/models',
          enhancedModels: 'GET /openrouter/models/enhanced',
          recommendations: 'GET /openrouter/recommendations/:useCase',
          dynamicDefaults: 'GET /openrouter/models/dynamic-defaults',
          clearCache: 'POST /openrouter/cache/clear',
          cacheStatus: 'GET /openrouter/cache/status',
          simpleCall: 'POST /openrouter/call',
          toolCall: 'POST /openrouter/tool/call',
          toolInfo: 'GET /openrouter/tool/info',
          registerTool: 'POST /openrouter/tool/register',
          executeViaToolManager: 'POST /openrouter/tool-manager/execute',
          examples: 'GET /openrouter/examples'
        }
      }
    });
  } catch (error) {
    console.error('Error generating examples:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate examples',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 