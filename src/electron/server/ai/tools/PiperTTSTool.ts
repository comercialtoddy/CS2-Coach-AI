import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import { PiperTTSService, PiperConfig } from '../../services/piperTTSServices.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Input interface for the PiperTTSTool
 */
export interface PiperTTSToolInput {
  text: string;
  language?: 'pt' | 'en' | 'fr' | 'es' | 'de';
  quality?: 'x_low' | 'low' | 'medium' | 'high';
  speaker?: number;
  outputFormat?: 'buffer' | 'file' | 'stream';
  filename?: string;
  maxLength?: number;
}

/**
 * Output interface for the PiperTTSTool
 */
export interface PiperTTSToolOutput {
  success: boolean;
  audioData?: {
    format: 'buffer' | 'file' | 'stream';
    size: number;
    duration?: number;
    sampleRate: number;
    channels: number;
  };
  buffer?: Buffer;
  filePath?: string;
  metadata: {
    text: string;
    textLength: number;
    language: string;
    model: string;
    quality: string;
    speaker?: number;
    processingTimeMs: number;
  };
}

/**
 * AI tool for text-to-speech conversion using Piper TTS
 * 
 * This tool provides high-quality neural text-to-speech synthesis
 * optimized for real-time feedback in CS2 applications.
 */
export class PiperTTSTool implements ITool<PiperTTSToolInput, PiperTTSToolOutput> {
  public readonly name = 'piper-tts-synthesize';
  
  public readonly description = 
    'Converts text to high-quality speech using Piper neural TTS engine. ' +
    'Supports multiple languages, voices, and quality levels. ' +
    'Optimized for low-latency real-time feedback in gaming applications.';

  public readonly inputSchema: Record<string, ToolParameterSchema> = {
    text: {
      type: 'string',
      description: 'Text to convert to speech. Should be clear and well-formed.',
      required: true
    },
    language: {
      type: 'string',
      description: 'Language code for synthesis (pt=Portuguese, en=English, fr=French, es=Spanish, de=German)',
      required: false,
      default: 'pt'
    },
    quality: {
      type: 'string',
      description: 'Audio quality level: x_low (fastest), low, medium (recommended), high (best quality)',
      required: false,
      default: 'medium'
    },
    speaker: {
      type: 'number',
      description: 'Speaker ID for multi-speaker models (0-based index)',
      required: false,
      default: 0
    },
    outputFormat: {
      type: 'string',
      description: 'Output format: buffer (in-memory), file (saved to disk), stream (for real-time)',
      required: false,
      default: 'buffer'
    },
    filename: {
      type: 'string',
      description: 'Output filename when using file format (without extension)',
      required: false,
      default: 'synthesized_speech'
    },
    maxLength: {
      type: 'number',
      description: 'Maximum text length to prevent excessive processing',
      required: false,
      default: 1000
    }
  };

  public readonly outputExample: PiperTTSToolOutput = {
    success: true,
    audioData: {
      format: 'buffer',
      size: 44100,
      duration: 2.5,
      sampleRate: 22050,
      channels: 1
    },
    metadata: {
      text: 'Bem-vindo ao sistema de síntese de voz do OpenHud!',
      textLength: 52,
      language: 'pt',
      model: 'pt_BR-faber-medium',
      quality: 'medium',
      speaker: 0,
      processingTimeMs: 150
    }
  };

  public readonly metadata: ToolMetadata = {
    version: '1.0.0',
    category: ToolCategory.AUDIO_PROCESSING,
    tags: ['tts', 'speech', 'audio', 'piper', 'synthesis', 'real-time'],
    author: 'OpenHud AI System',
    lastUpdated: new Date(),
    experimental: false,
    deprecated: false
  };

  private piperService: PiperTTSService;

  constructor() {
    this.piperService = PiperTTSService.getInstance();
  }

  /**
   * Validates input parameters according to the tool's schema
   */
  public validateInput(input: PiperTTSToolInput): {
    isValid: boolean;
    errors?: Array<{
      parameter: string;
      message: string;
      receivedType?: string;
      expectedType?: string;
    }>;
  } {
    const errors: Array<{
      parameter: string;
      message: string;
      receivedType?: string;
      expectedType?: string;
    }> = [];

    // Validate text
    if (!input.text || typeof input.text !== 'string') {
      errors.push({
        parameter: 'text',
        message: 'text is required and must be a non-empty string',
        receivedType: typeof input.text,
        expectedType: 'string'
      });
    } else if (input.text.trim().length === 0) {
      errors.push({
        parameter: 'text',
        message: 'text cannot be empty or only whitespace',
        receivedType: 'empty string',
        expectedType: 'non-empty string'
      });
    } else if (input.maxLength && input.text.length > input.maxLength) {
      errors.push({
        parameter: 'text',
        message: `text length (${input.text.length}) exceeds maximum allowed (${input.maxLength})`,
        receivedType: `string[${input.text.length}]`,
        expectedType: `string[<=${input.maxLength}]`
      });
    }

    // Validate language
    const validLanguages = ['pt', 'en', 'fr', 'es', 'de'];
    if (input.language && !validLanguages.includes(input.language)) {
      errors.push({
        parameter: 'language',
        message: `language must be one of: ${validLanguages.join(', ')}`,
        receivedType: input.language,
        expectedType: validLanguages.join(' | ')
      });
    }

    // Validate quality
    const validQualities = ['x_low', 'low', 'medium', 'high'];
    if (input.quality && !validQualities.includes(input.quality)) {
      errors.push({
        parameter: 'quality',
        message: `quality must be one of: ${validQualities.join(', ')}`,
        receivedType: input.quality,
        expectedType: validQualities.join(' | ')
      });
    }

    // Validate speaker
    if (input.speaker !== undefined) {
      if (typeof input.speaker !== 'number') {
        errors.push({
          parameter: 'speaker',
          message: 'speaker must be a number',
          receivedType: typeof input.speaker,
          expectedType: 'number'
        });
      } else if (!Number.isInteger(input.speaker) || input.speaker < 0) {
        errors.push({
          parameter: 'speaker',
          message: 'speaker must be a non-negative integer',
          receivedType: typeof input.speaker,
          expectedType: 'non-negative integer'
        });
      }
    }

    // Validate outputFormat
    const validFormats = ['buffer', 'file', 'stream'];
    if (input.outputFormat && !validFormats.includes(input.outputFormat)) {
      errors.push({
        parameter: 'outputFormat',
        message: `outputFormat must be one of: ${validFormats.join(', ')}`,
        receivedType: input.outputFormat,
        expectedType: validFormats.join(' | ')
      });
    }

    // Validate filename
    if (input.filename && typeof input.filename !== 'string') {
      errors.push({
        parameter: 'filename',
        message: 'filename must be a string',
        receivedType: typeof input.filename,
        expectedType: 'string'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Executes text-to-speech synthesis
   */
  public async execute(
    input: PiperTTSToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<PiperTTSToolOutput>> {
    const startTime = Date.now();
    
    try {
      // Prepare Piper configuration
      const piperConfig: Partial<PiperConfig> = {
        quality: input.quality || 'medium',
        speaker: input.speaker || 0
      };

      const text = input.text.trim();
      const outputFormat = input.outputFormat || 'buffer';
      
      let audioBuffer: Buffer | undefined;
      let filePath: string | undefined;
      let audioSize = 0;

      // Generate speech based on output format
      switch (outputFormat) {
        case 'buffer':
          audioBuffer = await this.piperService.textToSpeech(text, piperConfig);
          audioSize = audioBuffer.length;
          break;

        case 'file':
          const tempDir = path.join(__dirname, '../../../temp/audio');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const filename = (input.filename || 'synthesized_speech') + '.wav';
          filePath = path.join(tempDir, filename);
          
          await this.piperService.textToSpeechFile(text, filePath, piperConfig);
          
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            audioSize = stats.size;
          }
          break;

        case 'stream':
          // For streaming, we still generate the buffer but can chunk it
          audioBuffer = await this.piperService.textToSpeech(text, piperConfig);
          audioSize = audioBuffer.length;
          break;

        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      // Get available models to determine which was used
      const models = await this.piperService.getAvailableModels();
      const usedModel = models.length > 0 ? models[0] : { id: 'unknown', language: 'unknown' };

      // Calculate estimated duration (rough estimate: 22050 samples per second, 16-bit mono)
      const estimatedDuration = audioSize > 0 ? (audioSize / 2) / 22050 : 0;

      const result: PiperTTSToolOutput = {
        success: true,
        audioData: {
          format: outputFormat,
          size: audioSize,
          duration: estimatedDuration,
          sampleRate: 22050,
          channels: 1
        },
        buffer: audioBuffer,
        filePath: filePath,
        metadata: {
          text: text,
          textLength: text.length,
          language: input.language || 'pt',
          model: usedModel.id,
          quality: input.quality || 'medium',
          speaker: input.speaker,
          processingTimeMs: Date.now() - startTime
        }
      };

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: this.name,
          cached: false,
          requestId: context.requestId,
          audioFormat: outputFormat,
          textLength: text.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TTS_SYNTHESIS_ERROR',
          message: 'Failed to synthesize speech using Piper TTS',
          details: {
            originalError: error instanceof Error ? error.message : 'Unknown error',
            text: input.text,
            language: input.language,
            quality: input.quality,
            stackTrace: error instanceof Error ? error.stack : undefined
          }
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          source: this.name,
          cached: false
        }
      };
    }
  }

  /**
   * Health check to verify Piper TTS service availability
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    message?: string;
    details?: Record<string, any>;
  }> {
    try {
      // Test with a simple phrase
      const testText = 'Health check test';
      const startTime = Date.now();
      
      await this.piperService.textToSpeech(testText, { quality: 'x_low' });
      const responseTime = Date.now() - startTime;
      
      // Get available models
      const models = await this.piperService.getAvailableModels();
      
      return {
        healthy: true,
        message: 'Piper TTS service is working properly',
        details: {
          testText,
          responseTimeMs: responseTime,
          availableModels: models.length,
          modelsLoaded: models.map(m => ({ id: m.id, language: m.language, quality: m.quality })),
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Piper TTS service health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          suggestion: 'Check if Piper executable and voice models are properly installed'
        }
      };
    }
  }

  /**
   * Cleanup method to stop any running TTS processes
   */
  public async dispose(): Promise<void> {
    try {
      await this.piperService.cleanup();
      console.log(`PiperTTSTool '${this.name}' disposed successfully`);
    } catch (error) {
      console.error(`Error disposing PiperTTSTool '${this.name}':`, error);
    }
  }
} 