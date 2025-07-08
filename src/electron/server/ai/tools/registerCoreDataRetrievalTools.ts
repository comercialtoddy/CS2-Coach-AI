import { ToolManager } from '../ToolManager.js';
import { GetGSIInfoTool } from './GetGSIInfoTool.js';
import { GetTrackerGGStatsTool } from './GetTrackerGGStatsTool.js';
import { UpdatePlayerProfileTool } from './UpdatePlayerProfileTool.js';
import { AnalyzePositioningTool } from './AnalyzePositioningTool.js';

/**
 * Registers all Core Data Retrieval Tools with the ToolManager
 * 
 * This function should be called during server initialization to make all
 * three fundamental data retrieval tools available to the AI system.
 */
export function registerCoreDataRetrievalTools(toolManager: ToolManager): void {
  try {
    // Register GetGSIInfoTool
    const gsiTool = new GetGSIInfoTool();
    toolManager.register(gsiTool);
    console.log(`✅ Registered tool: ${gsiTool.name} - ${gsiTool.description}`);

    // Register GetTrackerGGStatsTool
    const trackerTool = new GetTrackerGGStatsTool();
    toolManager.register(trackerTool);
    console.log(`✅ Registered tool: ${trackerTool.name} - ${trackerTool.description}`);

    // Register UpdatePlayerProfileTool
    const profileTool = new UpdatePlayerProfileTool();
    toolManager.register(profileTool);
    console.log(`✅ Registered tool: ${profileTool.name} - ${profileTool.description}`);

    // Register AnalyzePositioningTool
    const analyzePositioningTool = new AnalyzePositioningTool();
    toolManager.register(analyzePositioningTool);
    console.log(`✅ Registered tool: ${analyzePositioningTool.name} - ${analyzePositioningTool.description}`);

    // Perform health checks
    const healthChecks = performToolHealthChecks(toolManager);
    console.log('✅ Core Data Retrieval Tools health checks:', healthChecks);
  } catch (error) {
    console.error('❌ Failed to register Core Data Retrieval Tools:', error);
    throw error;
  }
}

/**
 * Unregisters all Core Data Retrieval Tools from the ToolManager
 * Useful for cleanup during server shutdown
 */
export function unregisterCoreDataRetrievalTools(toolManager: ToolManager): void {
  try {
    toolManager.unregister('get-gsi-info');
    toolManager.unregister('get-trackergg-stats');
    toolManager.unregister('update-player-profile');
    toolManager.unregister('analyze-positioning');
    
    console.log('✅ Core Data Retrieval Tools unregistered successfully');
  } catch (error) {
    console.error('❌ Failed to unregister Core Data Retrieval Tools:', error);
    throw error;
  }
}

async function performToolHealthChecks(toolManager: ToolManager): Promise<Record<string, boolean>> {
  const toolNames = ['get-gsi-info', 'get-trackergg-stats', 'update-player-profile', 'analyze-positioning'];
  const tools = [];

  for (const name of toolNames) {
    const tool = toolManager.getTool(name);
    if (tool) {
      tools.push(tool);
    }
  }

  const healthChecks: Record<string, boolean> = {};
  for (const tool of tools) {
    try {
      // Basic health check - verify tool is registered and accessible
      healthChecks[tool.name] = true;
    } catch (error) {
      console.error(`❌ Health check failed for tool ${tool.name}:`, error);
      healthChecks[tool.name] = false;
    }
  }

  return healthChecks;
}

/**
 * Gets status information for all Core Data Retrieval Tools
 */
export async function getCoreDataRetrievalToolsStatus(toolManager: ToolManager): Promise<{
  registered: boolean;
  tools: Array<{
    name: string;
    registered: boolean;
    healthy: boolean;
    healthDetails?: any;
  }>;
  toolManagerStatus: {
    initialized: boolean;
    totalTools: number;
  };
}> {
  const toolNames = ['get-gsi-info', 'get-trackergg-stats', 'update-player-profile', 'analyze-positioning'];
  const tools = [];

  for (const toolName of toolNames) {
    const tool = toolManager.getTool(toolName);
    const registered = !!tool;
    
    let healthy = false;
    let healthDetails = null;
    
    if (registered && 'healthCheck' in tool && typeof tool.healthCheck === 'function') {
      try {
        const healthCheck = await tool.healthCheck();
        healthy = healthCheck.healthy;
        healthDetails = healthCheck;
      } catch (error) {
        healthy = false;
        healthDetails = { healthy: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    tools.push({
      name: toolName,
      registered,
      healthy,
      healthDetails
    });
  }

  const allTools = toolManager.getTools();
  return {
    registered: tools.every(tool => tool.registered),
    tools,
    toolManagerStatus: {
      initialized: true, // Assuming if we have a manager, it's 'initialized'
      totalTools: allTools.length
    }
  };
} 