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

const router = Router();

/**
 * OpenRouter API routes
 * Base path: /openrouter
 */

// GET /openrouter/status - Get service status and configuration
router.get('/status', getStatus);

// GET /openrouter/test - Test API connectivity
router.get('/test', testConnectionEndpoint);

// GET /openrouter/models - Get available models
router.get('/models', getModels);

// GET /openrouter/examples - Get usage examples and documentation
router.get('/examples', getExamples);

// POST /openrouter/call - Simple LLM call (direct service interface)
router.post('/call', simpleLLMCall);

// Tool-related routes
// GET /openrouter/tool/info - Get tool information and schema
router.get('/tool/info', getToolInfo);

// POST /openrouter/tool/call - Enhanced LLM call using AI Tool framework
router.post('/tool/call', toolLLMCall);

// POST /openrouter/tool/register - Register CallLLMTool with ToolManager
router.post('/tool/register', registerTool);

// Tool Manager integration routes
// POST /openrouter/tool-manager/execute - Execute via ToolManager
router.post('/tool-manager/execute', executeViaToolManager);

export default router; 