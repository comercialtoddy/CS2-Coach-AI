import { EncodingOptimizer } from './encodingOptimizer.js';

/**
 * Test encoding optimizer functionality
 */
async function testEncodingOptimizer() {
  console.log('🎥 Testing encoding optimizer functionality...\n');

  const optimizer = EncodingOptimizer.getInstance();

  // Get system capabilities
  console.log('1. System Capabilities:');
  const capabilities = optimizer.getSystemCapabilities();
  console.log('   CPU:', capabilities.cpu.model);
  console.log('   CPU Cores:', capabilities.cpu.cores);
  console.log('   Memory:', (capabilities.memory.total / (1024 * 1024 * 1024)).toFixed(2), 'GB');
  if (capabilities.gpu) {
    console.log('   GPU:', capabilities.gpu.vendor, capabilities.gpu.model);
    console.log('   Hardware Encoding Support:');
    Object.entries(capabilities.gpu.supports).forEach(([type, supported]) => {
      console.log(`     - ${type}: ${supported ? '✅' : '❌'}`);
    });
  } else {
    console.log('   GPU: No hardware encoding support detected');
  }
  console.log('');

  // Test encoding settings for different quality levels
  for (const quality of ['low', 'medium', 'high'] as const) {
    console.log(`2. Testing ${quality} quality settings:`);
    const settings = optimizer.getOptimizedSettings(quality);
    
    console.log('   Video Settings:');
    console.log('   - Codec:', settings.video.codec);
    console.log('   - Preset:', settings.video.preset);
    console.log('   - CRF:', settings.video.crf);
    console.log('   - Profile:', settings.video.profile);
    console.log('   - Level:', settings.video.level);
    if (settings.video.hwaccel) {
      console.log('   - Hardware Acceleration:', settings.video.hwaccel);
    }
    if (settings.video.extraOptions) {
      console.log('   - Extra Options:', settings.video.extraOptions.join(' '));
    }

    console.log('   Audio Settings:');
    console.log('   - Codec:', settings.audio.codec);
    console.log('   - Bitrate:', settings.audio.bitrate);
    console.log('   - Channels:', settings.audio.channels);
    console.log('   - Sample Rate:', settings.audio.sampleRate);
    console.log('');

    // Get FFmpeg command options
    console.log('   FFmpeg Command Options:');
    const options = optimizer.getCommandOptions(settings);
    console.log('   ', options.join(' '));
    console.log('');
  }

  console.log('🎉 Encoding optimizer functionality test complete!\n');
}

// Run the test
testEncodingOptimizer().catch(error => {
  console.error('❌ Test failed:', error);
}); 