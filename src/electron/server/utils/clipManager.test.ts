import { ClipManager } from './clipManager.js';
import fs from 'fs';
import path from 'path';

/**
 * Test clip manager functionality
 */
async function testClipManager() {
  console.log('🎥 Testing clip manager functionality...\n');

  const clipManager = ClipManager.getInstance();

  // Configure clip manager
  console.log('1. Configuring clip manager...');
  clipManager.configure({
    maxStorageGB: 5,
    maxClipDuration: 30,
    retentionDays: 7,
    defaultQuality: 'medium',
    autoCleanup: true
  });
  console.log('✅ Configuration applied');
  console.log('');

  // Create test clip
  console.log('2. Creating test clip...');
  const testClipPath = path.join(clipManager.getTempDir(), 'test-clip.mp4');
  
  // Create a dummy video file (1MB)
  const buffer = Buffer.alloc(1024 * 1024, 0);
  await fs.promises.writeFile(testClipPath, buffer);
  console.log('✅ Test clip created');
  console.log('');

  // Save clip
  console.log('3. Saving clip...');
  const clipMetadata = await clipManager.saveClip(testClipPath, {
    duration: 10,
    quality: 'medium',
    trigger: 'test',
    gameContext: {
      map: 'de_dust2',
      score: '15-14',
      event: 'clutch'
    }
  });

  if (clipMetadata) {
    console.log('✅ Clip saved successfully');
    console.log('   ID:', clipMetadata.id);
    console.log('   Timestamp:', clipMetadata.timestamp);
    console.log('   Size:', (clipMetadata.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('');

    // Get clip metadata
    console.log('4. Getting clip metadata...');
    const metadata = clipManager.getClipMetadata(clipMetadata.id);
    if (metadata) {
      console.log('✅ Metadata retrieved successfully');
      console.log('   Game Context:', metadata.gameContext);
      console.log('');
    }

    // Get clip path
    console.log('5. Getting clip path...');
    const clipPath = clipManager.getClipPath(clipMetadata.id);
    if (clipPath) {
      console.log('✅ Clip path retrieved successfully');
      console.log('   Path:', clipPath);
      console.log('');
    }

    // Get storage usage
    console.log('6. Getting storage usage...');
    const usage = await clipManager.getStorageUsage();
    console.log('✅ Storage usage retrieved successfully');
    console.log('   Total Size:', usage.totalSizeGB.toFixed(2), 'GB');
    console.log('   Clip Count:', usage.clipCount);
    console.log('   Oldest Clip:', usage.oldestClip);
    console.log('   Newest Clip:', usage.newestClip);
    console.log('');

    // Delete clip
    console.log('7. Deleting clip...');
    const deleted = await clipManager.deleteClip(clipMetadata.id);
    if (deleted) {
      console.log('✅ Clip deleted successfully');
    }
    console.log('');
  } else {
    console.error('❌ Failed to save clip');
  }

  // Clean up
  console.log('8. Running cleanup...');
  await clipManager.cleanup();
  console.log('✅ Cleanup complete');
  console.log('');

  console.log('🎉 Clip manager functionality test complete!\n');
}

// Run the test
testClipManager().catch(error => {
  console.error('❌ Test failed:', error);
}); 