import { Router } from 'express';
import {
  getStatus,
  testConnectionEndpoint,
  getModels,
  simpleLLMCall,
  toolLLMCall,
  getToolInfo,
  registerTool,
  executeViaToolManager,
  getExamples,
  // Enhanced model endpoints
  getEnhancedModelsEndpoint,
  getRecommendedModelsEndpoint,
  getDynamicDefaultModelsEndpoint,
  clearModelCacheEndpoint,
  getCacheStatusEndpoint
} from '../controllers/openRouterController.js';
import { asyncHandler } from '../helpers/asyncHandler.js';

export const openRouterRoutes = Router();

/**
 * OpenRouter API routes
 * Base path: /openrouter
 */

// GET /openrouter/status - Get service status and configuration
openRouterRoutes.get('/status', asyncHandler(getStatus));

// GET /openrouter/test - Test API connectivity
openRouterRoutes.get('/test', asyncHandler(testConnectionEndpoint));

// GET /openrouter/models - Get available models (raw models)
openRouterRoutes.get('/models', asyncHandler(getModels));

// GET /openrouter/models/enhanced - Get enhanced models with filtering and caching
openRouterRoutes.get('/models/enhanced', asyncHandler(getEnhancedModelsEndpoint));

// GET /openrouter/recommendations/:useCase - Get recommended models for specific use cases
openRouterRoutes.get('/recommendations/:useCase', asyncHandler(getRecommendedModelsEndpoint));

// GET /openrouter/models/dynamic-defaults - Get dynamic default models (replacement for static DEFAULT_MODELS)
openRouterRoutes.get('/models/dynamic-defaults', asyncHandler(getDynamicDefaultModelsEndpoint));

// Cache management routes
// POST /openrouter/cache/clear - Clear model cache
openRouterRoutes.post('/cache/clear', asyncHandler(clearModelCacheEndpoint));

// GET /openrouter/cache/status - Get cache status
openRouterRoutes.get('/cache/status', asyncHandler(getCacheStatusEndpoint));

// GET /openrouter/examples - Get usage examples and documentation
openRouterRoutes.get('/examples', asyncHandler(getExamples));

// POST /openrouter/call - Simple LLM call (direct service interface)
openRouterRoutes.post('/call', asyncHandler(simpleLLMCall));

// Tool-related routes
// GET /openrouter/tool/info - Get tool information and schema
openRouterRoutes.get('/tool/info', asyncHandler(getToolInfo));

// POST /openrouter/tool/call - Enhanced LLM call using AI Tool framework
openRouterRoutes.post('/tool/call', asyncHandler(toolLLMCall));

// POST /openrouter/tool/register - Register CallLLMTool with ToolManager
openRouterRoutes.post('/tool/register', asyncHandler(registerTool));

// Tool Manager integration routes
// POST /openrouter/tool-manager/execute - Execute via ToolManager
openRouterRoutes.post('/tool-manager/execute', asyncHandler(executeViaToolManager)); 