import { FFmpegUtil } from './ffmpeg.js';
import { ScreenCapture } from './screenCapture.js';
import { AudioCapture } from './audioCapture.js';
import { EncodingOptimizer } from './encodingOptimizer.js';
import { ClipManager } from './clipManager.js';
import { ResourceManager, ResourceManagerEvent } from './resourceManager.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

interface VideoRecorderOptions {
  displayId?: string;
  audioDeviceId?: string;
  fps?: number;
  duration?: number; // in seconds
  quality?: 'low' | 'medium' | 'high';
  outputPath?: string;
  trigger?: string;
  gameContext?: {
    map?: string;
    score?: string;
    event?: string;
  };
}

interface VideoRecorderResult {
  success: boolean;
  filePath?: string;
  clipId?: string;
  error?: string;
}

interface Display {
  id: string;
  name: string;
}

interface AudioDevice {
  id: string;
  name: string;
  isInput: boolean;
}

/**
 * Video recorder utility class
 */
export class VideoRecorder {
  private static instance: VideoRecorder;
  private readonly ffmpegUtil: FFmpegUtil;
  private readonly screenCapture: ScreenCapture;
  private readonly audioCapture: AudioCapture;
  private readonly encodingOptimizer: EncodingOptimizer;
  private readonly clipManager: ClipManager;
  private readonly resourceManager: ResourceManager;
  private isRecording: boolean = false;
  private currentCommand: any = null;
  private currentPid: number | null = null;

  private constructor() {
    this.ffmpegUtil = FFmpegUtil.getInstance();
    this.screenCapture = ScreenCapture.getInstance();
    this.audioCapture = AudioCapture.getInstance();
    this.encodingOptimizer = EncodingOptimizer.getInstance();
    this.clipManager = ClipManager.getInstance();
    this.resourceManager = ResourceManager.getInstance();

    // Configure resource manager
    this.resourceManager.configure({
      monitoringInterval: 1000,
      thresholds: {
        cpu: 80,
        memory: 80,
        disk: 90
      },
      autoKillEnabled: true
    });

    // Start resource monitoring
    this.resourceManager.startMonitoring();

    // Handle resource warnings
    this.resourceManager.on(ResourceManagerEvent.RESOURCE_WARNING, (data) => {
      console.warn(`Resource warning during recording: ${data.resource} usage at ${data.usage.toFixed(1)}%`);

      // If recording is in progress, try to reduce quality
      if (this.isRecording && this.currentCommand) {
        this.adjustQualityForResource(data.resource);
      }
    });

    // Handle resource critical events
    this.resourceManager.on(ResourceManagerEvent.RESOURCE_CRITICAL, (data) => {
      console.error(`Resource critical during recording: ${data.resource} usage at ${data.usage.toFixed(1)}%`);

      // If recording is in progress, stop it
      if (this.isRecording) {
        console.error('Stopping recording due to critical resource usage');
        this.stopRecording();
      }
    });

    // Handle process errors
    this.resourceManager.on(ResourceManagerEvent.PROCESS_ERROR, (data) => {
      console.error(`Recording process error: ${data.error}`);
      this.isRecording = false;
      this.currentCommand = null;
      this.currentPid = null;
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): VideoRecorder {
    if (!VideoRecorder.instance) {
      VideoRecorder.instance = new VideoRecorder();
    }
    return VideoRecorder.instance;
  }

  /**
   * Start recording
   */
  public async startRecording(options: VideoRecorderOptions = {}): Promise<VideoRecorderResult> {
    if (this.isRecording) {
      return {
        success: false,
        error: 'Recording is already in progress'
      };
    }

    try {
      // Check resource availability before starting
      const usage = await this.resourceManager.getResourceUsage();
      if (usage.cpu.usage > 70 || usage.memory.percentage > 70) {
        return {
          success: false,
          error: 'System resources are too constrained to start recording'
        };
      }

      // Get available displays
      const displays = await this.screenCapture.getDisplays();
      const display = options.displayId
        ? displays.find((d: Display) => d.id === options.displayId)
        : displays[0];

      if (!display) {
        throw new Error('No valid display found');
      }

      // Get available audio devices
      const audioDevices = await this.audioCapture.listDevices();
      const audioDevice = options.audioDeviceId
        ? audioDevices.find((d: AudioDevice) => d.id === options.audioDeviceId)
        : audioDevices[0];

      if (!audioDevice) {
        throw new Error('No valid audio device found');
      }

      // Set output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const tempPath = path.join(this.clipManager.getTempDir(), `recording-${timestamp}.mp4`);

      // Get optimized encoding settings
      const encodingSettings = this.encodingOptimizer.getOptimizedSettings(options.quality || 'medium');
      const encodingOptions = this.encodingOptimizer.getCommandOptions(encodingSettings);

      // Create FFmpeg command
      const command = this.ffmpegUtil.getCommand();

      // Configure screen capture input
      const screenInput = await this.screenCapture.getInputOptions();
      command
        .input(screenInput.input)
        .inputOptions(screenInput.options)
        .inputOptions([
          '-framerate', options.fps?.toString() || '30'
        ]);

      // Configure audio capture input
      const audioInput = await this.audioCapture.getInputOptions(audioDevice.id);
      command
        .input(audioInput.input)
        .inputOptions(audioInput.options);

      // Configure output
      command
        .output(tempPath)
        .outputOptions(encodingOptions)
        .outputOptions([
          '-movflags', '+faststart',
          '-y' // Overwrite output file if exists
        ]);

      // Add duration limit if specified
      if (options.duration) {
        command.duration(options.duration);
      }

      // Add event handlers
      command
        .on('start', (commandLine: string) => {
          console.log('Recording started');
          this.isRecording = true;

          // Extract process ID and register with resource manager
          const pidMatch = commandLine.match(/pid=(\d+)/);
          if (pidMatch) {
            this.currentPid = parseInt(pidMatch[1]);
            this.resourceManager.registerProcess(this.currentPid, 'ffmpeg-recording');
          }
        })
        .on('end', async () => {
          console.log('Recording finished');
          this.isRecording = false;
          this.currentCommand = null;

          // Unregister process
          if (this.currentPid) {
            this.resourceManager.unregisterProcess(this.currentPid);
            this.currentPid = null;
          }

          // Save clip
          const clipMetadata = await this.clipManager.saveClip(tempPath, {
            duration: options.duration || 0,
            quality: options.quality || 'medium',
            trigger: options.trigger,
            gameContext: options.gameContext
          });

          if (clipMetadata) {
            console.log('Clip saved:', clipMetadata.id);
          }
        })
        .on('error', (err: Error) => {
          console.error('Recording error:', err);
          this.isRecording = false;
          this.currentCommand = null;

          // Report error and unregister process
          if (this.currentPid) {
            this.resourceManager.reportProcessError(this.currentPid, err);
            this.resourceManager.unregisterProcess(this.currentPid);
            this.currentPid = null;
          }
        });

      // Start recording
      this.currentCommand = command;
      command.run();

      return {
        success: true,
        filePath: tempPath
      };

    } catch (error) {
      console.error('Failed to start recording:', error);
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
    if (this.isRecording && this.currentCommand) {
      // Kill the FFmpeg process
      if (this.currentPid) {
        this.resourceManager.killProcess(this.currentPid);
      } else {
        this.currentCommand.kill('SIGTERM');
      }

      this.isRecording = false;
      this.currentCommand = null;
      this.currentPid = null;
    }
  }

  /**
   * Check if recording is in progress
   */
  public isRecordingInProgress(): boolean {
    return this.isRecording;
  }

  /**
   * Clean up temporary files
   */
  public async cleanup(): Promise<void> {
    // Stop any active recording
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clean up clips
    await this.clipManager.cleanup();
  }

  /**
   * Adjust encoding quality based on resource constraints
   */
  private adjustQualityForResource(resource: string): void {
    if (!this.currentCommand) return;

    // Get current settings
    const currentSettings = this.encodingOptimizer.getOptimizedSettings('medium');

    switch (resource) {
      case 'cpu':
        // Use faster preset and lower quality
        currentSettings.video.preset = 'ultrafast';
        currentSettings.video.crf = Math.min(currentSettings.video.crf + 4, 30);
        break;

      case 'memory':
        // Add memory optimization flags
        currentSettings.video.extraOptions = [
          '-max_muxing_queue_size', '1024',
          '-rc-lookahead', '20'
        ];
        break;

      case 'disk':
        // Lower bitrate and quality
        currentSettings.video.crf = Math.min(currentSettings.video.crf + 6, 32);
        currentSettings.audio.bitrate = '96k';
        break;
    }

    // Apply new settings
    const newOptions = this.encodingOptimizer.getCommandOptions(currentSettings);
    this.currentCommand.outputOptions(newOptions);
  }
} 