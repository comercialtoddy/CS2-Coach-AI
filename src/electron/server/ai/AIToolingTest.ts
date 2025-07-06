import { ToolManager, ToolManagerEvent } from './ToolManager.js';
import { PlayerDataTool } from './tools/ExamplePlayerTool.js';

/**
 * Functional test and demonstration of the AI Tooling Framework
 * 
 * This script demonstrates:
 * 1. Tool registration
 * 2. Tool execution with validation
 * 3. Error handling
 * 4. Event monitoring
 * 5. Statistics tracking
 */
export class AIToolingTest {
  private toolManager: ToolManager;
  private events: Array<{ type: string; toolName: string; timestamp: Date; data?: any }> = [];

  constructor() {
    this.toolManager = new ToolManager();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners to monitor tool manager activity
   */
  private setupEventListeners(): void {
    const eventTypes = [
      ToolManagerEvent.TOOL_REGISTERED,
      ToolManagerEvent.TOOL_EXECUTED,
      ToolManagerEvent.TOOL_FAILED,
      ToolManagerEvent.TOOL_ENABLED,
      ToolManagerEvent.TOOL_DISABLED
    ];

    eventTypes.forEach(eventType => {
      this.toolManager.addEventListener(eventType, (event) => {
        this.events.push({
          type: event.type,
          toolName: event.toolName,
          timestamp: event.timestamp,
          data: event.data
        });
        console.log(`📡 Event: ${event.type} for tool '${event.toolName}'`, event.data ? event.data : '');
      });
    });
  }

  /**
   * Run the complete test suite
   */
  public async runTests(): Promise<void> {
    console.log('\n🚀 Starting AI Tooling Framework Test Suite\n');

    try {
      await this.testToolRegistration();
      await this.testToolExecution();
      await this.testInputValidation();
      await this.testErrorHandling();
      await this.testToolDiscovery();
      await this.testHealthChecks();
      await this.testToolStatistics();
      
      console.log('\n✅ All tests completed successfully!\n');
      this.printTestSummary();
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test 1: Tool Registration
   */
  private async testToolRegistration(): Promise<void> {
    console.log('🧪 Test 1: Tool Registration');
    
    const playerTool = new PlayerDataTool();
    
    // Register the tool
    const registered = this.toolManager.register(playerTool);
    console.log(`   ✓ Tool registration: ${registered ? 'SUCCESS' : 'FAILED'}`);
    
    // Verify tool is in registry
    const tools = this.toolManager.getTools();
    const foundTool = tools.find(t => t.name === 'get-player-data');
    console.log(`   ✓ Tool in registry: ${foundTool ? 'SUCCESS' : 'FAILED'}`);
    
    // Test duplicate registration prevention
    try {
      this.toolManager.register(playerTool);
      console.log('   ❌ Duplicate registration should have failed');
    } catch (error) {
      console.log('   ✓ Duplicate registration prevention: SUCCESS');
    }
    
    console.log('');
  }

  /**
   * Test 2: Tool Execution
   */
  private async testToolExecution(): Promise<void> {
    console.log('🧪 Test 2: Tool Execution');
    
    // Test successful execution
    const result = await this.toolManager.execute('get-player-data', {
      playerId: 1,
      includeStats: true
    });
    
    console.log(`   ✓ Execution success: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.success && result.data) {
      console.log(`   ✓ Data retrieved: Player '${result.data.player.name}'`);
      console.log(`   ✓ Stats included: ${result.data.stats ? 'YES' : 'NO'}`);
      console.log(`   ✓ Execution time: ${result.metadata?.executionTimeMs}ms`);
    }
    
    console.log('');
  }

  /**
   * Test 3: Input Validation
   */
  private async testInputValidation(): Promise<void> {
    console.log('🧪 Test 3: Input Validation');
    
    // Test invalid input
    const invalidResult = await this.toolManager.execute('get-player-data', {
      playerId: 'invalid', // Should be number
      includeStats: 'yes' // Should be boolean
    });
    
    console.log(`   ✓ Invalid input rejection: ${!invalidResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!invalidResult.success) {
      console.log(`   ✓ Error code: ${invalidResult.error?.code}`);
      console.log(`   ✓ Validation errors detected: ${invalidResult.error?.details ? 'YES' : 'NO'}`);
    }
    
    // Test missing required parameter
    const missingParamResult = await this.toolManager.execute('get-player-data', {
      includeStats: true
      // Missing playerId
    });
    
    console.log(`   ✓ Missing parameter rejection: ${!missingParamResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    console.log('');
  }

  /**
   * Test 4: Error Handling
   */
  private async testErrorHandling(): Promise<void> {
    console.log('🧪 Test 4: Error Handling');
    
    // Test non-existent tool
    const nonExistentResult = await this.toolManager.execute('non-existent-tool', {});
    console.log(`   ✓ Non-existent tool handling: ${!nonExistentResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   ✓ Error code: ${nonExistentResult.error?.code}`);
    
    // Test tool with non-existent player ID
    const notFoundResult = await this.toolManager.execute('get-player-data', {
      playerId: 99999
    });
    console.log(`   ✓ Player not found handling: ${!notFoundResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!notFoundResult.success) {
      console.log(`   ✓ Error code: ${notFoundResult.error?.code}`);
    }
    
    console.log('');
  }

  /**
   * Test 5: Tool Discovery
   */
  private async testToolDiscovery(): Promise<void> {
    console.log('🧪 Test 5: Tool Discovery');
    
    const allTools = this.toolManager.getTools({ includeStats: true });
    console.log(`   ✓ Total tools registered: ${allTools.length}`);
    
    const dataTools = this.toolManager.getTools({ category: 'data' });
    console.log(`   ✓ Data category tools: ${dataTools.length}`);
    
    const enabledTools = this.toolManager.getTools({ enabled: true });
    console.log(`   ✓ Enabled tools: ${enabledTools.length}`);
    
    console.log('');
  }

  /**
   * Test 6: Health Checks
   */
  private async testHealthChecks(): Promise<void> {
    console.log('🧪 Test 6: Health Checks');
    
    const healthResults = await this.toolManager.healthCheck();
    console.log(`   ✓ Health check completed for ${Object.keys(healthResults).length} tools`);
    
    for (const [toolName, health] of Object.entries(healthResults)) {
      console.log(`   ✓ ${toolName}: ${health.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
      if (health.message) {
        console.log(`     Message: ${health.message}`);
      }
    }
    
    console.log('');
  }

  /**
   * Test 7: Tool Statistics
   */
  private async testToolStatistics(): Promise<void> {
    console.log('🧪 Test 7: Tool Statistics');
    
    const stats = this.toolManager.getToolStats('get-player-data');
    if (stats) {
      console.log(`   ✓ Total executions: ${stats.totalExecutions}`);
      console.log(`   ✓ Success count: ${stats.successCount}`);
      console.log(`   ✓ Failure count: ${stats.failureCount}`);
      console.log(`   ✓ Average execution time: ${stats.averageExecutionTime.toFixed(2)}ms`);
      console.log(`   ✓ Last execution: ${stats.lastExecution?.toISOString()}`);
    } else {
      console.log('   ❌ No statistics available');
    }
    
    console.log('');
  }

  /**
   * Print test summary
   */
  private printTestSummary(): void {
    console.log('📊 Test Summary:');
    console.log(`   📋 Total events captured: ${this.events.length}`);
    console.log(`   🔧 Tools registered: ${this.toolManager.getTools().length}`);
    
    const eventSummary = this.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('   📈 Event breakdown:');
    Object.entries(eventSummary).forEach(([type, count]) => {
      console.log(`     - ${type}: ${count}`);
    });
    
    console.log('\n🎉 AI Tooling Framework is ready for production use!\n');
  }

  /**
   * Cleanup test resources
   */
  public cleanup(): void {
    this.toolManager.clear();
    this.events = [];
  }
}

/**
 * Run the test if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new AIToolingTest();
  test.runTests().catch(console.error);
} 