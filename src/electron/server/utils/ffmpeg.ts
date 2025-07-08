import ffmpeg from 'fluent-ffmpeg';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * FFmpeg utility class for video recording and processing
 */
export class FFmpegUtil {
  private static instance: FFmpegUtil;
  private readonly tempDir: string;

  private constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'openhud-clips');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FFmpegUtil {
    if (!FFmpegUtil.instance) {
      FFmpegUtil.instance = new FFmpegUtil();
    }
    return FFmpegUtil.instance;
  }

  /**
   * Check if FFmpeg is installed and accessible
   */
  public async checkFFmpeg(): Promise<{ installed: boolean; version?: string; error?: string }> {
    try {
      // Get FFmpeg path
      const command = ffmpeg();
      const ffmpegPath = await new Promise<string>((resolve, reject) => {
        command.on('error', reject);
        command.on('start', (commandLine: string) => {
          const pathMatch = commandLine.match(/^"([^"]+)"/);
          if (pathMatch) {
            resolve(pathMatch[1]);
          } else {
            reject(new Error('Could not extract FFmpeg path from command line'));
          }
        });
        command.outputOptions(['-version']);
        command.save('/dev/null'); // This will trigger the 'start' event
      });

      // Execute FFmpeg version command
      const { stdout } = await execAsync(`"${ffmpegPath}" -version`);
      const versionMatch = stdout.match(/version\s+([\d.]+)/i);

      // Check available formats and codecs
      const formats = await this.getAvailableFormats();
      const encoders = await this.getAvailableEncoders();

      if (!formats.length || !encoders.video.length) {
        return {
          installed: false,
          error: 'FFmpeg installation appears incomplete'
        };
      }

      return {
        installed: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      };
    } catch (error) {
      return {
        installed: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get available formats
   */
  public getAvailableFormats(): Promise<string[]> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve([]);
          return;
        }
        resolve(Object.keys(formats));
      });
    });
  }

  /**
   * Get available encoders
   */
  public async getAvailableEncoders(): Promise<{ video: string[]; audio: string[] }> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableEncoders((err, encoders) => {
        if (err) {
          resolve({ video: [], audio: [] });
          return;
        }

        const video: string[] = [];
        const audio: string[] = [];

        for (const [name, info] of Object.entries(encoders)) {
          if (info.type === 'video') {
            video.push(name);
          } else if (info.type === 'audio') {
            audio.push(name);
          }
        }

        resolve({ video, audio });
      });
    });
  }

  /**
   * Get FFmpeg command instance
   */
  public getCommand(): ffmpeg.FfmpegCommand {
    return ffmpeg();
  }

  /**
   * Get temporary directory path
   */
  public getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Clean up temporary files
   */
  public async cleanup(): Promise<void> {
    if (fs.existsSync(this.tempDir)) {
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });
    }
  }
} 