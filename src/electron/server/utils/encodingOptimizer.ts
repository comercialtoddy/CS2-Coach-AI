import os from 'os';

interface EncodingPreset {
  video: {
    codec: string;
    preset: string;
    crf: number;
    profile: string;
    level: string;
    pixelFormat: string;
    hwaccel?: string;
    extraOptions?: string[];
  };
  audio: {
    codec: string;
    bitrate: string;
    channels: number;
    sampleRate: number;
  };
}

interface SystemCapabilities {
  cpu: {
    cores: number;
    model: string;
  };
  gpu?: {
    vendor: string;
    model: string;
    supports: {
      nvenc?: boolean;
      qsv?: boolean;
      amf?: boolean;
      vaapi?: boolean;
    };
  };
  memory: {
    total: number;
    free: number;
  };
}

/**
 * Encoding optimizer utility class
 */
export class EncodingOptimizer {
  private static instance: EncodingOptimizer;
  private systemCapabilities: SystemCapabilities;

  private constructor() {
    this.systemCapabilities = this.detectSystemCapabilities();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EncodingOptimizer {
    if (!EncodingOptimizer.instance) {
      EncodingOptimizer.instance = new EncodingOptimizer();
    }
    return EncodingOptimizer.instance;
  }

  /**
   * Detect system capabilities
   */
  private detectSystemCapabilities(): SystemCapabilities {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // Basic system info
    const capabilities: SystemCapabilities = {
      cpu: {
        cores: cpus.length,
        model: cpus[0].model
      },
      memory: {
        total: totalMemory,
        free: freeMemory
      }
    };

    // Detect GPU and hardware encoding support
    const platform = os.platform();
    if (platform === 'win32') {
      try {
        // Check for NVIDIA GPU (NVENC)
        const { execSync } = require('child_process');
        const nvidiaSmiOutput = execSync('nvidia-smi -L', { encoding: 'utf8' });
        if (nvidiaSmiOutput) {
          capabilities.gpu = {
            vendor: 'NVIDIA',
            model: nvidiaSmiOutput.split(':')[1]?.split('(')[0]?.trim() || 'Unknown',
            supports: {
              nvenc: true
            }
          };
        }
      } catch {
        // No NVIDIA GPU found, try Intel QuickSync
        try {
          const intelGpu = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' })
            .split('\n')
            .find(line => line.toLowerCase().includes('intel'));
          if (intelGpu) {
            capabilities.gpu = {
              vendor: 'Intel',
              model: intelGpu.trim(),
              supports: {
                qsv: true
              }
            };
          }
        } catch {
          // No Intel GPU found, try AMD
          try {
            const amdGpu = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' })
              .split('\n')
              .find(line => line.toLowerCase().includes('amd') || line.toLowerCase().includes('radeon'));
            if (amdGpu) {
              capabilities.gpu = {
                vendor: 'AMD',
                model: amdGpu.trim(),
                supports: {
                  amf: true
                }
              };
            }
          } catch {
            // No hardware encoding support found
          }
        }
      }
    } else if (platform === 'linux') {
      try {
        // Check for VAAPI support
        const { execSync } = require('child_process');
        execSync('vainfo');
        capabilities.gpu = {
          vendor: 'Generic',
          model: 'VAAPI Compatible',
          supports: {
            vaapi: true
          }
        };
      } catch {
        // No VAAPI support found
      }
    }

    return capabilities;
  }

  /**
   * Get optimized encoding settings based on system capabilities
   */
  public getOptimizedSettings(quality: 'low' | 'medium' | 'high'): EncodingPreset {
    const { cpu, gpu, memory } = this.systemCapabilities;

    // Base settings for different quality levels
    const baseSettings: Record<string, EncodingPreset> = {
      low: {
        video: {
          codec: 'libx264',
          preset: 'ultrafast',
          crf: 28,
          profile: 'baseline',
          level: '3.0',
          pixelFormat: 'yuv420p'
        },
        audio: {
          codec: 'aac',
          bitrate: '96k',
          channels: 2,
          sampleRate: 44100
        }
      },
      medium: {
        video: {
          codec: 'libx264',
          preset: 'veryfast',
          crf: 23,
          profile: 'main',
          level: '4.0',
          pixelFormat: 'yuv420p'
        },
        audio: {
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          sampleRate: 44100
        }
      },
      high: {
        video: {
          codec: 'libx264',
          preset: 'medium',
          crf: 18,
          profile: 'high',
          level: '4.2',
          pixelFormat: 'yuv420p'
        },
        audio: {
          codec: 'aac',
          bitrate: '256k',
          channels: 2,
          sampleRate: 48000
        }
      }
    };

    // Get base settings for requested quality
    const settings = JSON.parse(JSON.stringify(baseSettings[quality]));

    // Optimize based on CPU
    if (cpu.cores <= 2) {
      // For very low-end CPUs, use faster presets
      settings.video.preset = 'ultrafast';
      settings.video.crf = Math.min(settings.video.crf + 4, 30);
    } else if (cpu.cores >= 8) {
      // For high-end CPUs, we can use slower presets for better quality
      if (quality === 'high') {
        settings.video.preset = 'slow';
      }
    }

    // Optimize based on available memory
    const availableMemoryGB = memory.free / (1024 * 1024 * 1024);
    if (availableMemoryGB < 2) {
      // For low memory systems, add memory optimization flags
      settings.video.extraOptions = [
        '-max_muxing_queue_size', '1024',
        '-rc-lookahead', '20'
      ];
    }

    // Apply hardware acceleration if available
    if (gpu?.supports) {
      if (gpu.supports.nvenc) {
        // NVIDIA GPU
        settings.video.codec = 'h264_nvenc';
        settings.video.preset = quality === 'high' ? 'p7' : quality === 'medium' ? 'p4' : 'p1';
        settings.video.hwaccel = 'cuda';
      } else if (gpu.supports.qsv) {
        // Intel QuickSync
        settings.video.codec = 'h264_qsv';
        settings.video.preset = quality === 'high' ? 'slower' : quality === 'medium' ? 'medium' : 'faster';
        settings.video.hwaccel = 'qsv';
      } else if (gpu.supports.amf) {
        // AMD
        settings.video.codec = 'h264_amf';
        settings.video.preset = quality === 'high' ? 'quality' : quality === 'medium' ? 'balanced' : 'speed';
        settings.video.hwaccel = 'amf';
      } else if (gpu.supports.vaapi) {
        // VAAPI (Linux)
        settings.video.codec = 'h264_vaapi';
        settings.video.hwaccel = 'vaapi';
      }
    }

    return settings;
  }

  /**
   * Get FFmpeg command options from encoding settings
   */
  public getCommandOptions(settings: EncodingPreset): string[] {
    const options: string[] = [];

    // Add hardware acceleration if specified
    if (settings.video.hwaccel) {
      options.push('-hwaccel', settings.video.hwaccel);
    }

    // Add video codec options
    options.push(
      '-c:v', settings.video.codec,
      '-preset', settings.video.preset,
      '-crf', settings.video.crf.toString(),
      '-profile:v', settings.video.profile,
      '-level', settings.video.level,
      '-pix_fmt', settings.video.pixelFormat
    );

    // Add audio codec options
    options.push(
      '-c:a', settings.audio.codec,
      '-b:a', settings.audio.bitrate,
      '-ac', settings.audio.channels.toString(),
      '-ar', settings.audio.sampleRate.toString()
    );

    // Add any extra options
    if (settings.video.extraOptions) {
      options.push(...settings.video.extraOptions);
    }

    return options;
  }

  /**
   * Get system capabilities
   */
  public getSystemCapabilities(): SystemCapabilities {
    return this.systemCapabilities;
  }
} 