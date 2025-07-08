import { ScreenCapture } from './screenCapture.js';
import fs from 'fs';

/**
 * Test screen capture functionality
 */
async function testScreenCapture() {
  console.log('🎥 Testing screen capture functionality...\n');

  const screenCapture = ScreenCapture.getInstance();

  // Get available displays
  console.log('1. Getting available displays...');
  const displays = await screenCapture.getDisplays();
  console.log('✅ Available displays:', displays.length);
  displays.forEach((display: { id: string; name: string }) => {
    console.log(`   - ${display.name} (${display.id})`);
  });
  console.log('');

  // Test recording with different quality settings
  for (const quality of ['low', 'medium', 'high'] as const) {
    console.log(`2. Testing ${quality} quality recording...`);
    
    // Start recording
    console.log('   Starting recording...');
    const result = await screenCapture.startRecording({
      quality,
      fps: 30,
      displayId: displays[0].id
    });

    if (!result.success) {
      console.error(`❌ Recording failed: ${result.error}`);
      continue;
    }

    console.log('   Recording started');
    console.log('   Output file:', result.filePath);

    // Record for 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Stop recording
    console.log('   Stopping recording...');
    screenCapture.stopRecording();

    // Verify file exists and has content
    if (result.filePath && fs.existsSync(result.filePath)) {
      const stats = fs.statSync(result.filePath);
      console.log('✅ Recording saved successfully');
      console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.error('❌ Recording file not found');
    }

    console.log('');
  }

  console.log('🎉 Screen capture functionality test complete!\n');
}

// Run the test
testScreenCapture().catch(error => {
  console.error('❌ Test failed:', error);
}); 