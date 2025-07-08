import { ToolManager } from '../ToolManager.js';
import { Tool_CaptureScreenshot } from './Tool_CaptureScreenshot.js';

/**
 * Registers the Screenshot Capture Tool with the ToolManager
 * 
 * This function should be called during server initialization to make the
 * screenshot capture functionality available to the AI system.
 */
export function registerScreenshotTool(toolManager: ToolManager): void {
  try {
    // Register Tool_CaptureScreenshot
    const screenshotTool = new Tool_CaptureScreenshot();
    toolManager.register(screenshotTool, {
      override: true, // Allow overriding if already registered
      enabled: true
    });
    console.log(`✅ Registered tool: ${screenshotTool.name} - ${screenshotTool.description}`);

    // Perform health check
    const tools = toolManager.getTools();
    const registered = tools.some(tool => tool.name === screenshotTool.name);
    console.log('✅ Screenshot Tool registration status:', registered ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.error('❌ Failed to register Screenshot Tool:', error);
    throw error;
  }
}

/**
 * Unregisters the Screenshot Tool from the ToolManager
 * Useful for cleanup during server shutdown
 */
export function unregisterScreenshotTool(toolManager: ToolManager): void {
  try {
    toolManager.unregister('Tool_CaptureScreenshot');
    console.log('✅ Screenshot Tool unregistered successfully');
  } catch (error) {
    console.error('❌ Failed to unregister Screenshot Tool:', error);
    throw error;
  }
} 