import { AudioCapture, AudioDevice } from './audioCapture.js';
import fs from 'fs';
import path from 'path';

/**
 * Test audio capture functionality
 */
async function testAudioCapture() {
  console.log('🎤 Testing audio capture functionality...\n');

  const audioCapture = AudioCapture.getInstance();

  // Get available audio devices
  console.log('1. Getting available audio devices...');
  const devices = await audioCapture.listDevices();
  console.log('✅ Available audio devices:', devices.length);
  devices.forEach((device: AudioDevice) => {
    console.log(`   - ${device.name} (${device.id})`);
  });
  console.log('');

  // Test recording with different quality settings
  for (const quality of ['low', 'medium', 'high'] as const) {
    console.log(`2. Testing ${quality} quality recording...`);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `audio-test-${quality}.m4a`);

    // Start recording
    console.log('   Starting recording...');
    const result = await audioCapture.startRecording({
      quality,
      deviceId: devices[0]?.id,
      outputPath
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
    audioCapture.stopRecording();

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

  console.log('🎉 Audio capture functionality test complete!\n');
}

// Run the test
testAudioCapture().catch(error => {
  console.error('❌ Test failed:', error);
});

describe('AudioCapture', () => {
  let audioCapture: AudioCapture;

  beforeAll(() => {
    audioCapture = AudioCapture.getInstance();
  });

  test('should list audio devices', async () => {
    const devices = await audioCapture.listDevices();
    console.log('✅ Available audio devices:', devices.length);
    devices.forEach((device: AudioDevice) => {
      console.log(`   - ${device.name} (${device.id})`);
    });
    expect(devices.length).toBeGreaterThan(0);
  });
}); 