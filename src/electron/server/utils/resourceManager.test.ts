import { ResourceManager, ResourceManagerEvent } from './resourceManager';

/**
 * Test resource manager functionality
 */
async function testResourceManager() {
  console.log('🔍 Testing Resource Manager functionality...\n');

  const resourceManager = ResourceManager.getInstance();

  // Test configuration
  console.log('1. Testing configuration...');
  resourceManager.configure({
    monitoringInterval: 2000,
    thresholds: {
      cpu: 70,
      memory: 75,
      disk: 85
    },
    autoKillEnabled: true
  });
  console.log('✅ Configuration applied');
  console.log('');

  // Test resource monitoring
  console.log('2. Testing resource monitoring...');
  
  // Set up event listeners
  resourceManager.on(ResourceManagerEvent.RESOURCE_WARNING, (data) => {
    console.log(`   Resource warning: ${data.resource} at ${data.usage.toFixed(1)}%`);
  });

  resourceManager.on(ResourceManagerEvent.RESOURCE_CRITICAL, (data) => {
    console.log(`   Resource critical: ${data.resource} at ${data.usage.toFixed(1)}%`);
  });

  resourceManager.on(ResourceManagerEvent.PROCESS_ERROR, (data) => {
    console.log(`   Process error: PID ${data.pid} (${data.name}) - ${data.error}`);
  });

  // Start monitoring
  resourceManager.startMonitoring();
  console.log('✅ Resource monitoring started');
  console.log('');

  // Test resource usage retrieval
  console.log('3. Testing resource usage retrieval...');
  const usage = await resourceManager.getResourceUsage();
  console.log('   CPU Usage:', usage.cpu.usage.toFixed(1) + '%');
  console.log('   CPU Cores:', usage.cpu.cores);
  console.log('   Memory Usage:', usage.memory.percentage.toFixed(1) + '%');
  console.log('   Memory Free:', (usage.memory.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB');
  console.log('   Memory Total:', (usage.memory.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB');
  if (usage.disk) {
    console.log('   Disk Usage:', usage.disk.percentage.toFixed(1) + '%');
    console.log('   Disk Free:', (usage.disk.free / (1024 * 1024 * 1024)).toFixed(2) + ' GB');
    console.log('   Disk Total:', (usage.disk.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB');
  }
  console.log('✅ Resource usage retrieved');
  console.log('');

  // Test process registration and monitoring
  console.log('4. Testing process registration...');
  const testPid = process.pid;
  resourceManager.registerProcess(testPid, 'test-process');
  console.log('✅ Process registered');
  console.log('');

  // Wait for a few monitoring cycles
  console.log('5. Waiting for monitoring cycles (5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('✅ Monitoring cycles completed');
  console.log('');

  // Test process unregistration
  console.log('6. Testing process unregistration...');
  resourceManager.unregisterProcess(testPid);
  console.log('✅ Process unregistered');
  console.log('');

  // Stop monitoring
  console.log('7. Stopping resource monitoring...');
  resourceManager.stopMonitoring();
  console.log('✅ Resource monitoring stopped');
  console.log('');

  console.log('🎉 Resource manager functionality test complete!\n');
}

// Run the test
testResourceManager().catch(console.error); 