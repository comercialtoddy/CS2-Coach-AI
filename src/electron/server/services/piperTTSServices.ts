import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

export interface PiperConfig {
  modelPath: string;
  configPath: string;
  sampleRate: number;
  quality: 'x_low' | 'low' | 'medium' | 'high';
  speaker?: number;
}

export interface VoiceModel {
  id: string;
  language: string;
  quality: string;
  speaker?: string;
  files: {
    onnx: string;
    json: string;
  };
  urls: {
    onnx: string;
    json: string;
  };
}

export class PiperTTSService {
  private static instance: PiperTTSService;
  private piperPath: string;
  private modelsPath: string;
  private currentProcess?: ChildProcess;
  private isInitialized = false;

  constructor() {
    this.piperPath = path.join(__dirname, '../../../assets/piper');
    this.modelsPath = path.join(this.piperPath, 'models');
  }

  static getInstance(): PiperTTSService {
    if (!PiperTTSService.instance) {
      PiperTTSService.instance = new PiperTTSService();
    }
    return PiperTTSService.instance;
  }

  /**
   * Initialize Piper TTS system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create directories if they don't exist
      await this.ensureDirectoriesExist();

      // Check for Piper executable
      await this.ensurePiperExecutable();

      // Check for voice models
      await this.ensureVoiceModels();

      this.isInitialized = true;
      console.log('Piper TTS Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Piper TTS Service:', error);
      throw error;
    }
  }

  /**
   * Convert text to speech and return audio buffer
   */
  async textToSpeech(
    text: string,
    options: Partial<PiperConfig> = {}
  ): Promise<Buffer> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const config = await this.getDefaultConfig(options);
    
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      // Command arguments for Piper
      const args = [
        '--model', config.modelPath,
        '--output-raw'
      ];

      if (config.speaker !== undefined) {
        args.push('--speaker', config.speaker.toString());
      }

      // Spawn Piper process
      const piperProcess = spawn(this.getPiperExecutablePath(), args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout (audio data)
      piperProcess.stdout.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      // Handle stderr (logs/errors)
      piperProcess.stderr.on('data', (data: Buffer) => {
        console.log('Piper stderr:', data.toString());
      });

      // Handle process completion
      piperProcess.on('close', (code) => {
        if (code === 0) {
          const audioBuffer = Buffer.concat(chunks);
          resolve(audioBuffer);
        } else {
          reject(new Error(`Piper process exited with code ${code}`));
        }
      });

      // Handle process errors
      piperProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn Piper process: ${error.message}`));
      });

      // Send text to Piper stdin
      piperProcess.stdin.write(text);
      piperProcess.stdin.end();

      // Store reference for cleanup
      this.currentProcess = piperProcess;
    });
  }

  /**
   * Convert text to speech and save to file
   */
  async textToSpeechFile(
    text: string,
    outputPath: string,
    options: Partial<PiperConfig> = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const config = await this.getDefaultConfig(options);
    
    return new Promise((resolve, reject) => {
      // Command arguments for Piper
      const args = [
        '--model', config.modelPath,
        '--output_file', outputPath
      ];

      if (config.speaker !== undefined) {
        args.push('--speaker', config.speaker.toString());
      }

      // Spawn Piper process
      const piperProcess = spawn(this.getPiperExecutablePath(), args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stderr (logs/errors)
      piperProcess.stderr.on('data', (data: Buffer) => {
        console.log('Piper stderr:', data.toString());
      });

      // Handle process completion
      piperProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Piper process exited with code ${code}`));
        }
      });

      // Handle process errors
      piperProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn Piper process: ${error.message}`));
      });

      // Send text to Piper stdin
      piperProcess.stdin.write(text);
      piperProcess.stdin.end();

      // Store reference for cleanup
      this.currentProcess = piperProcess;
    });
  }

  /**
   * Get available voice models
   */
  async getAvailableModels(): Promise<VoiceModel[]> {
    const modelsDir = this.modelsPath;
    const models: VoiceModel[] = [];

    if (!fs.existsSync(modelsDir)) {
      return models;
    }

    const files = fs.readdirSync(modelsDir);
    const onnxFiles = files.filter(f => f.endsWith('.onnx'));

    for (const onnxFile of onnxFiles) {
      const jsonFile = onnxFile + '.json';
      const onnxPath = path.join(modelsDir, onnxFile);
      const jsonPath = path.join(modelsDir, jsonFile);

      if (fs.existsSync(jsonPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          const modelId = path.basename(onnxFile, '.onnx');
          
          models.push({
            id: modelId,
            language: config.language?.code || 'unknown',
            quality: this.extractQuality(modelId),
            speaker: config.speaker_id_map ? Object.keys(config.speaker_id_map)[0] : undefined,
            files: {
              onnx: onnxPath,
              json: jsonPath
            },
            urls: {
              onnx: '',
              json: ''
            }
          });
        } catch (error) {
          console.error(`Error reading model config ${jsonFile}:`, error);
        }
      }
    }

    return models;
  }

  /**
   * Download and install default Portuguese voice model
   */
  async downloadDefaultModel(): Promise<void> {
    const models = [
      {
        id: 'pt_BR-faber-medium',
        onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx',
        jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json'
      }
    ];

    for (const model of models) {
      await this.downloadModel(model.id, model.onnxUrl, model.jsonUrl);
    }
  }

  /**
   * Download a specific voice model
   */
  private async downloadModel(id: string, onnxUrl: string, jsonUrl: string): Promise<void> {
    const onnxPath = path.join(this.modelsPath, `${id}.onnx`);
    const jsonPath = path.join(this.modelsPath, `${id}.onnx.json`);

    // Skip if already downloaded
    if (fs.existsSync(onnxPath) && fs.existsSync(jsonPath)) {
      console.log(`Model ${id} already exists, skipping download`);
      return;
    }

    console.log(`Downloading model: ${id}`);

    try {
      // Download ONNX model
      await this.downloadFile(onnxUrl, onnxPath);
      console.log(`Downloaded ONNX model: ${id}`);

      // Download JSON config
      await this.downloadFile(jsonUrl, jsonPath);
      console.log(`Downloaded JSON config: ${id}`);

    } catch (error) {
      console.error(`Failed to download model ${id}:`, error);
      // Cleanup partial downloads
      if (fs.existsSync(onnxPath)) fs.unlinkSync(onnxPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      throw error;
    }
  }

  /**
   * Download Piper executable for Windows
   */
  private async downloadPiperExecutable(): Promise<void> {
    const executablePath = this.getPiperExecutablePath();
    
    if (fs.existsSync(executablePath)) {
      console.log('Piper executable already exists, skipping download');
      return;
    }

    console.log('Downloading Piper executable...');

    // Download URL for Windows x64 binary
    const downloadUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
    const tempZipPath = path.join(this.piperPath, 'piper_temp.zip');

    try {
      // Download the zip file
      await this.downloadFile(downloadUrl, tempZipPath);
      
      // For now, we'll assume manual extraction
      // In a production environment, you'd want to use a zip extraction library
      console.log(`Downloaded Piper executable to: ${tempZipPath}`);
      console.log('Please extract the contents to the piper directory manually');
      
    } catch (error) {
      console.error('Failed to download Piper executable:', error);
      throw error;
    }
  }

  /**
   * Stop current TTS process
   */
  async stop(): Promise<void> {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = undefined;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.isInitialized = false;
  }

  // Private helper methods

  private async ensureDirectoriesExist(): Promise<void> {
    const directories = [this.piperPath, this.modelsPath];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }

  private async ensurePiperExecutable(): Promise<void> {
    const executablePath = this.getPiperExecutablePath();
    
    if (!fs.existsSync(executablePath)) {
      console.log('Piper executable not found, downloading...');
      await this.downloadPiperExecutable();
    }
  }

  private async ensureVoiceModels(): Promise<void> {
    const models = await this.getAvailableModels();
    
    if (models.length === 0) {
      console.log('No voice models found, downloading default Portuguese model...');
      await this.downloadDefaultModel();
    }
  }

  private getPiperExecutablePath(): string {
    const platform = process.platform;
    const executableName = platform === 'win32' ? 'piper.exe' : 'piper';
    return path.join(this.piperPath, 'piper', executableName);
  }

  private async getDefaultConfig(options: Partial<PiperConfig> = {}): Promise<PiperConfig> {
    const models = await this.getAvailableModels();
    
    if (models.length === 0) {
      throw new Error('No voice models available');
    }

    // Use the first available model as default
    const defaultModel = models[0];
    
    return {
      modelPath: defaultModel.files.onnx,
      configPath: defaultModel.files.json,
      sampleRate: 22050,
      quality: 'medium',
      ...options
    };
  }

  private extractQuality(modelId: string): string {
    if (modelId.includes('x_low')) return 'x_low';
    if (modelId.includes('low')) return 'low';
    if (modelId.includes('medium')) return 'medium';
    if (modelId.includes('high')) return 'high';
    return 'unknown';
  }

  private async downloadFile(url: string, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(filepath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          if (response.headers.location) {
            this.downloadFile(response.headers.location, filepath)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        pipeline(response, file)
          .then(() => resolve())
          .catch((error) => {
            fs.unlink(filepath, () => {}); // Cleanup on error
            reject(error);
          });
      }).on('error', (error) => {
        fs.unlink(filepath, () => {}); // Cleanup on error
        reject(error);
      });
    });
  }
} 