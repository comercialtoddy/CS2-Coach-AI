import { desktopCapturer, screen } from 'electron';
import { FFmpegUtil } from './ffmpeg.js';
import path from 'path';
import os from 'os';

interface ScreenCaptureOptions {
  displayId?: string;
  fps?: number;
  quality?: 'low' | 'medium' | 'high';
  outputPath?: string;
}

interface ScreenCaptureResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Screen capture utility class
 */
export class ScreenCapture {
  private static instance: ScreenCapture;
  private readonly ffmpegUtil: FFmpegUtil;

  private constructor() {
    this.ffmpegUtil = FFmpegUtil.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ScreenCapture {
    if (!ScreenCapture.instance) {
      ScreenCapture.instance = new ScreenCapture();
    }
    return ScreenCapture.instance;
  }

  /**
   * Get screen capture input options based on OS
   */
  public getInputOptions(): { input: string; options: string[] } {
    const platform = os.platform();
    const display = screen.getPrimaryDisplay();
    const { width, height } = display.size;

    switch (platform) {
      case 'win32':
        return {
          input: 'desktop',
          options: [
            '-f', 'gdigrab',
            '-framerate', '30',
            '-offset_x', '0',
            '-offset_y', '0',
            '-video_size', `${width}x${height}`
          ]
        };

      case 'darwin':
        return {
          input: '0:none',
          options: [
            '-f', 'avfoundation',
            '-framerate', '30',
            '-i', '1',
            '-video_size', `${width}x${height}`
          ]
        };

      case 'linux':
        return {
          input: ':0.0',
          options: [
            '-f', 'x11grab',
            '-framerate', '30',
            '-video_size', `${width}x${height}`
          ]
        };

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Get quality settings based on option
   */
  private getQualitySettings(quality: 'low' | 'medium' | 'high' = 'medium'): string[] {
    switch (quality) {
      case 'low':
        return [
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-profile:v', 'baseline',
          '-level', '3.0',
          '-pix_fmt', 'yuv420p'
        ];

      case 'high':
        return [
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-profile:v', 'high',
          '-level', '4.2',
          '-pix_fmt', 'yuv420p'
        ];

      case 'medium':
      default:
        return [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-profile:v', 'main',
          '-level', '4.0',
          '-pix_fmt', 'yuv420p'
        ];
    }
  }

  /**
   * Start screen recording
   */
  public async startRecording(options: ScreenCaptureOptions = {}): Promise<ScreenCaptureResult> {
    try {
      // Get screen sources
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const source = options.displayId
        ? sources.find(s => s.id === options.displayId)
        : sources[0];

      if (!source) {
        throw new Error('No valid screen source found');
      }

      // Get input options based on OS
      const { input, options: inputOptions } = this.getInputOptions();

      // Get quality settings
      const qualitySettings = this.getQualitySettings(options.quality);

      // Set output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = options.outputPath || path.join(this.ffmpegUtil.getTempDir(), `recording-${timestamp}.mp4`);

      // Create FFmpeg command
      const command = this.ffmpegUtil.getCommand();

      // Configure input
      command
        .input(input)
        .inputOptions(inputOptions)
        .inputOptions([
          '-framerate', options.fps?.toString() || '30'
        ]);

      // Configure output
      command
        .output(outputPath)
        .outputOptions(qualitySettings)
        .outputOptions([
          '-movflags', '+faststart',
          '-y' // Overwrite output file if exists
        ]);

      // Start recording
      command.run();

      return {
        success: true,
        filePath: outputPath
      };

    } catch (error) {
      console.error('Screen recording failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Stop recording
   */
  public stopRecording(): void {
    const command = this.ffmpegUtil.getCommand();
    command.kill('SIGTERM');
  }

  /**
   * Get available displays
   */
  public async getDisplays(): Promise<{ id: string; name: string }[]> {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name
    }));
  }
} 