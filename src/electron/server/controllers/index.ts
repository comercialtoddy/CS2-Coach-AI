export * from "./playersController.js";
export * from "./teamsController.js";
export * from "./matchesController.js";
export * from "./coachesController.js";
export * from "./settingsController.js";
export * from "./trackerGGController.js";
export * from "./piperTTSController.js";
export * from "./agentOverlayDemoController.js";
export { 
    getStatus as getOpenRouterStatus,
    testConnectionEndpoint,
    getModels,
    simpleLLMCall,
    toolLLMCall,
    getToolInfo,
    registerTool,
    executeViaToolManager,
    getExamples
 } from "./openRouterController.js";
export * from "./dataRetrievalController.js";

// Export with renamed healthCheck functions to avoid conflicts
export { 
    generateTasks,
    getTaskTypes,
    getPlayerTasks,
    updateTaskProgress,
    cancelTask,
    getTaskStats,
    validateTaskRequest,
    healthCheck as taskGenerationHealthCheck
} from "./taskGenerationController.js";

// Export taskProgressController with renamed healthCheck
export {
    getProgressStats,
    simulateGameEvent,
    getPlayerProgress,
    startTracker,
    stopTracker,
    testProgressPipeline,
    healthCheck as taskProgressHealthCheck
} from "./taskProgressController.js";

// Export rewardAssignmentController with renamed healthCheck
export {
    getPlayerRewards,
    getPlayerRewardStats,
    getSystemStats,
    testRewardPipeline,
    healthCheck as rewardAssignmentHealthCheck
} from "./rewardAssignmentController.js";
