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
  getExamples
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

// GET /openrouter/models - Get available models
openRouterRoutes.get('/models', asyncHandler(getModels));

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