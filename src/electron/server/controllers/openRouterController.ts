import { Request, Response } from 'express';
import { 
  callLLM, 
  getAvailableModels, 
  testConnection, 
  isOpenRouterConfigured, 
  getOpenRouterStatus,
  DEFAULT_MODELS,
  LLMCallOptions 
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

    res.json({
      success: true,
      data: {
        ...status,
        availableModels: Object.keys(DEFAULT_MODELS),
        defaultModels: DEFAULT_MODELS,
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
 * Get list of available models from OpenRouter
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
    const examples = {
      basicCall: {
        endpoint: 'POST /openrouter/call',
        description: 'Simple LLM call with just a prompt',
        body: {
          prompt: 'Explain quantum computing in simple terms',
          options: {
            model: DEFAULT_MODELS.BALANCED,
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
          model: DEFAULT_MODELS.CREATIVE,
          fallbackModels: [DEFAULT_MODELS.BALANCED, DEFAULT_MODELS.FAST],
          temperature: 0.9,
          maxTokens: 100
        }
      },
      toolManagerExecution: {
        endpoint: 'POST /openrouter/tool-manager/execute',
        description: 'Execute LLM call via the Tool Manager framework',
        body: {
          prompt: 'Summarize the benefits of renewable energy',
          model: DEFAULT_MODELS.SMART,
          maxTokens: 300,
          temperature: 0.5
        }
      }
    };

    res.json({
      success: true,
      data: {
        examples,
        availableModels: DEFAULT_MODELS,
        endpoints: {
          status: 'GET /openrouter/status',
          test: 'GET /openrouter/test',
          models: 'GET /openrouter/models',
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