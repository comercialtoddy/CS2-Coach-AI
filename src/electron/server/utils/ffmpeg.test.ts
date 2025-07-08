import { FFmpegUtil } from './ffmpeg.js';

describe('FFmpegUtil', () => {
  let ffmpegUtil: FFmpegUtil;

  beforeAll(() => {
    ffmpegUtil = FFmpegUtil.getInstance();
  });

  test('should check FFmpeg installation', async () => {
    const result = await ffmpegUtil.checkFFmpeg();
    console.log('✅ FFmpeg installation check:', result);
    expect(result.installed).toBe(true);
  });

  test('should get available encoders', async () => {
    const encoders = await ffmpegUtil.getAvailableEncoders();
    console.log('✅ Available encoders:', {
      video: encoders.video.length,
      audio: encoders.audio.length
    });
    expect(encoders.video.length).toBeGreaterThan(0);
    expect(encoders.audio.length).toBeGreaterThan(0);
  });
});

/**
 * Test FFmpeg functionality
 */
async function testFFmpeg() {
  console.log('🎥 Testing FFmpeg functionality...\n');

  const ffmpegUtil = FFmpegUtil.getInstance();

  // Check FFmpeg installation
  console.log('1. Checking FFmpeg installation...');
  const ffmpegCheck = await ffmpegUtil.checkFFmpeg();
  if (ffmpegCheck.installed) {
    console.log('✅ FFmpeg is installed');
    console.log(`   Version: ${ffmpegCheck.version}`);
  } else {
    console.error('❌ FFmpeg is not installed or not accessible');
    console.error(`   Error: ${ffmpegCheck.error}`);
    return;
  }
  console.log('');

  // Get available encoders
  console.log('2. Getting available encoders...');
  const encoders = await ffmpegUtil.getAvailableEncoders();
  console.log('✅ Available video encoders:', encoders.video.length);
  console.log('✅ Available audio encoders:', encoders.audio.length);
  console.log('');

  // Get available formats
  console.log('3. Getting available formats...');
  const formats = await ffmpegUtil.getAvailableFormats();
  console.log('✅ Available formats:', formats.length);
  console.log('');

  // Test temporary directory
  console.log('4. Testing temporary directory...');
  const tempDir = ffmpegUtil.getTempDir();
  console.log('✅ Temporary directory:', tempDir);
  console.log('');

  console.log('🎉 FFmpeg functionality test complete!\n');
}

// Run the test
testFFmpeg().catch(error => {
  console.error('❌ Test failed:', error);
}); 