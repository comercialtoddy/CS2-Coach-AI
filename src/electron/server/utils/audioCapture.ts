import { FFmpegUtil } from './ffmpeg.js';
import os from 'os';
import { exec } from 'child_process';

interface AudioDevice {
  id: string;
  name: string;
  isInput: boolean;
}

interface AudioCaptureOptions {
  deviceId?: string;
  quality?: 'low' | 'medium' | 'high';
  outputPath?: string;
}

interface AudioCaptureResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Audio capture utility class
 */
export class AudioCapture {
  private static instance: AudioCapture;
  private readonly ffmpegUtil: FFmpegUtil;

  private constructor() {
    this.ffmpegUtil = FFmpegUtil.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AudioCapture {
    if (!AudioCapture.instance) {
      AudioCapture.instance = new AudioCapture();
    }
    return AudioCapture.instance;
  }

  /**
   * Get audio capture input options based on OS
   */
  public getInputOptions(deviceId?: string): { input: string; options: string[] } {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        return {
          input: deviceId || 'audio=virtual-audio-capturer',
          options: [
            '-f', 'dshow',
            '-audio_buffer_size', '50'
          ]
        };

      case 'darwin':
        return {
          input: deviceId || ':0',
          options: [
            '-f', 'avfoundation',
            '-audio_device_index', '0'
          ]
        };

      case 'linux':
        return {
          input: deviceId || 'default',
          options: [
            '-f', 'pulse',
            '-sample_rate', '44100'
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
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ac', '2',
          '-ar', '44100'
        ];

      case 'high':
        return [
          '-c:a', 'aac',
          '-b:a', '256k',
          '-ac', '2',
          '-ar', '48000'
        ];

      case 'medium':
      default:
        return [
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ac', '2',
          '-ar', '44100'
        ];
    }
  }

  /**
   * List available audio devices using platform-specific commands
   */
  public async listDevices(): Promise<AudioDevice[]> {
    const platform = os.platform();

    return new Promise((resolve) => {
      switch (platform) {
        case 'win32':
          // Use PowerShell to list audio devices on Windows
          exec('powershell "Get-WmiObject Win32_SoundDevice | Select-Object Name"', (err, stdout) => {
            if (err) {
              resolve([]);
              return;
            }

            const devices = stdout.split('\n')
              .filter(line => line.trim() && !line.includes('Name'))
              .map(line => ({
                id: line.trim(),
                name: line.trim(),
                isInput: true
              }));

            resolve(devices);
          });
          break;

        case 'darwin':
          // Use system_profiler to list audio devices on macOS
          exec('system_profiler SPAudioDataType | grep "Input"', (err, stdout) => {
            if (err) {
              resolve([]);
              return;
            }

            const devices = stdout.split('\n')
              .filter(line => line.includes(':'))
              .map((line, index) => ({
                id: index.toString(),
                name: line.split(':')[1].trim(),
                isInput: true
              }));

            resolve(devices);
          });
          break;

        case 'linux':
          // Use pactl to list audio devices on Linux
          exec('pactl list sources | grep "Name:"', (err, stdout) => {
            if (err) {
              resolve([{
                id: 'default',
                name: 'System Default',
                isInput: true
              }]);
              return;
            }

            const devices = stdout.split('\n')
              .filter(line => line.includes('Name:'))
              .map(line => {
                const name = line.split('Name:')[1].trim();
                return {
                  id: name,
                  name: name,
                  isInput: true
                };
              });

            resolve(devices.length > 0 ? devices : [{
              id: 'default',
              name: 'System Default',
              isInput: true
            }]);
          });
          break;

        default:
          resolve([]);
      }
    });
  }

  /**
   * Start audio recording
   */
  public async startRecording(options: AudioCaptureOptions = {}): Promise<AudioCaptureResult> {
    try {
      // Get input options based on OS
      const { input, options: inputOptions } = this.getInputOptions(options.deviceId);

      // Get quality settings
      const qualitySettings = this.getQualitySettings(options.quality);

      // Create FFmpeg command
      const command = this.ffmpegUtil.getCommand();

      // Configure input
      command
        .input(input)
        .inputOptions(inputOptions);

      // Configure output
      command
        .output(options.outputPath || 'output.m4a')
        .outputOptions(qualitySettings)
        .outputOptions([
          '-y' // Overwrite output file if exists
        ]);

      // Start recording
      command.run();

      return {
        success: true,
        filePath: options.outputPath
      };

    } catch (error) {
      console.error('Audio recording failed:', error);
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
} 