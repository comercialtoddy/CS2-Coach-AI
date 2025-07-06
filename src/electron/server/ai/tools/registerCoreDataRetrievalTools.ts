import { ToolManager } from '../ToolManager.js';
import { GetGSIInfoTool } from './GetGSIInfoTool.js';
import { GetTrackerGGStatsTool } from './GetTrackerGGStatsTool.js';
import { UpdatePlayerProfileTool } from './UpdatePlayerProfileTool.js';

/**
 * Registers all Core Data Retrieval Tools with the ToolManager
 * 
 * This function should be called during server initialization to make all
 * three fundamental data retrieval tools available to the AI system.
 */
export async function registerCoreDataRetrievalTools(): Promise<void> {
  console.log('🔧 Registering Core Data Retrieval Tools...');

  const toolManager = ToolManager.getInstance();

  try {
    // Initialize ToolManager if not already initialized
    if (!toolManager.isInitialized()) {
      await toolManager.initialize();
      console.log('✅ ToolManager initialized');
    }

    // Register GetGSIInfoTool
    const gsiTool = new GetGSIInfoTool();
    await toolManager.registerTool(gsiTool);
    console.log(`✅ Registered tool: ${gsiTool.name} - ${gsiTool.description}`);

    // Register GetTrackerGGStatsTool
    const trackerTool = new GetTrackerGGStatsTool();
    await toolManager.registerTool(trackerTool);
    console.log(`✅ Registered tool: ${trackerTool.name} - ${trackerTool.description}`);

    // Register UpdatePlayerProfileTool
    const profileTool = new UpdatePlayerProfileTool();
    await toolManager.registerTool(profileTool);
    console.log(`✅ Registered tool: ${profileTool.name} - ${profileTool.description}`);

    // Perform health checks
    console.log('🏥 Performing health checks...');
    
    const gsiHealth = await gsiTool.healthCheck();
    console.log(`🏥 GSI Tool Health: ${gsiHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'} - ${gsiHealth.message}`);
    
    const trackerHealth = await trackerTool.healthCheck();
    console.log(`🏥 TrackerGG Tool Health: ${trackerHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'} - ${trackerHealth.message}`);
    
    const profileHealth = await profileTool.healthCheck();
    console.log(`🏥 Player Profile Tool Health: ${profileHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'} - ${profileHealth.message}`);

    // Summary
    const registeredTools = toolManager.getRegisteredToolNames();
    console.log(`🎉 Successfully registered ${registeredTools.length} tools in ToolManager:`);
    registeredTools.forEach(toolName => {
      console.log(`   - ${toolName}`);
    });

    console.log('✅ Core Data Retrieval Tools registration complete!');

  } catch (error) {
    console.error('❌ Failed to register Core Data Retrieval Tools:', error);
    throw error;
  }
}

/**
 * Unregisters all Core Data Retrieval Tools from the ToolManager
 * Useful for cleanup during server shutdown
 */
export async function unregisterCoreDataRetrievalTools(): Promise<void> {
  console.log('🧹 Unregistering Core Data Retrieval Tools...');

  const toolManager = ToolManager.getInstance();

  try {
    if (toolManager.isInitialized()) {
      await toolManager.unregisterTool('get-gsi-info');
      await toolManager.unregisterTool('get-trackergg-stats');
      await toolManager.unregisterTool('update-player-profile');
      
      console.log('✅ Core Data Retrieval Tools unregistered successfully');
    }
  } catch (error) {
    console.error('❌ Failed to unregister Core Data Retrieval Tools:', error);
    throw error;
  }
}

/**
 * Gets status information for all Core Data Retrieval Tools
 */
export async function getCoreDataRetrievalToolsStatus(): Promise<{
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
  const toolManager = ToolManager.getInstance();
  
  const toolNames = ['get-gsi-info', 'get-trackergg-stats', 'update-player-profile'];
  const tools = [];

  for (const toolName of toolNames) {
    const tool = toolManager.getTool(toolName);
    const registered = !!tool;
    
    let healthy = false;
    let healthDetails = null;
    
    if (registered && tool.healthCheck) {
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

  return {
    registered: tools.every(tool => tool.registered),
    tools,
    toolManagerStatus: {
      initialized: toolManager.isInitialized(),
      totalTools: toolManager.getRegisteredToolNames().length
    }
  };
} 