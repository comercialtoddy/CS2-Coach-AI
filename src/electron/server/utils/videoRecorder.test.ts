import { VideoRecorder } from './videoRecorder';
import fs from 'fs';
import path from 'path';

/**
 * Test video recorder functionality
 */
async function testVideoRecorder() {
  console.log('🎥 Testing video recorder functionality...\n');

  const videoRecorder = VideoRecorder.getInstance();

  // Get available displays
  console.log('1. Getting available displays...');
  const displays = await videoRecorder.screenCapture.getDisplays();
  console.log('✅ Available displays:', displays.length);
  displays.forEach(display => {
    console.log(`   - ${display.name} (${display.id})`);
  });
  console.log('');

  // Get available audio devices
  console.log('2. Getting available audio devices...');
  const audioDevices = await videoRecorder.audioCapture.listDevices();
  console.log('✅ Available audio devices:', audioDevices.length);
  audioDevices.forEach(device => {
    console.log(`   - ${device.name} (${device.id})`);
  });
  console.log('');

  // Test recording with different quality settings
  for (const quality of ['low', 'medium', 'high'] as const) {
    console.log(`3. Testing ${quality} quality recording...`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `video-test-${quality}.mp4`);

    // Start recording
    console.log('   Starting recording...');
    const result = await videoRecorder.startRecording({
      quality,
      fps: 30,
      duration: 5, // Record for 5 seconds
      displayId: displays[0]?.id,
      audioDeviceId: audioDevices[0]?.id,
      outputPath
    });

    if (!result.success) {
      console.error(`❌ Recording failed: ${result.error}`);
      continue;
    }

    console.log('   Recording started');
    console.log('   Output file:', result.filePath);

    // Wait for recording to complete (duration + 1 second buffer)
    await new Promise(resolve => setTimeout(resolve, 6000));

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

  // Test recording status
  console.log('4. Testing recording status...');
  console.log('   Is recording in progress:', videoRecorder.isRecordingInProgress());
  console.log('');

  // Clean up
  console.log('5. Cleaning up...');
  await videoRecorder.cleanup();
  console.log('✅ Cleanup complete');
  console.log('');

  console.log('🎉 Video recorder functionality test complete!\n');
}

// Run the test
testVideoRecorder().catch(error => {
  console.error('❌ Test failed:', error);
}); 