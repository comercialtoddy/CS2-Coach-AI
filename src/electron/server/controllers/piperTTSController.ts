import { Request, Response } from 'express';
import { PiperTTSService, PiperConfig } from '../services/piperTTSServices.js';
import * as path from 'path';
import * as fs from 'fs';

export class PiperTTSController {
  private piperService: PiperTTSService;

  constructor() {
    this.piperService = PiperTTSService.getInstance();
  }

  /**
   * Initialize Piper TTS system
   * POST /api/piper-tts/initialize
   */
  async initialize(req: Request, res: Response): Promise<void> {
    try {
      await this.piperService.initialize();
      res.json({
        success: true,
        message: 'Piper TTS initialized successfully'
      });
    } catch (error: any) {
      console.error('Failed to initialize Piper TTS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initialize Piper TTS',
        details: error.message
      });
    }
  }

  /**
   * Convert text to speech and return audio buffer
   * POST /api/piper-tts/synthesize
   * Body: { text: string, options?: PiperConfig }
   */
  async synthesize(req: Request, res: Response): Promise<void> {
    try {
      const { text, options = {} } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Text is required and must be a string'
        });
        return;
      }

      const audioBuffer = await this.piperService.textToSpeech(text, options);

      // Set appropriate headers for audio response
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="speech.wav"');

      res.send(audioBuffer);
    } catch (error: any) {
      console.error('Failed to synthesize speech:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to synthesize speech',
        details: error.message
      });
    }
  }

  /**
   * Convert text to speech and save to file
   * POST /api/piper-tts/synthesize-file
   * Body: { text: string, filename?: string, options?: PiperConfig }
   */
  async synthesizeToFile(req: Request, res: Response): Promise<void> {
    try {
      const { text, filename = 'speech.wav', options = {} } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Text is required and must be a string'
        });
        return;
      }

      // Create temporary directory for audio files
      const tempDir = path.join(__dirname, '../../../temp/audio');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const outputPath = path.join(tempDir, filename);

      await this.piperService.textToSpeechFile(text, outputPath, options);

      res.json({
        success: true,
        message: 'Speech synthesized successfully',
        filename,
        path: outputPath
      });
    } catch (error: any) {
      console.error('Failed to synthesize speech to file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to synthesize speech to file',
        details: error.message
      });
    }
  }

  /**
   * Get available voice models
   * GET /api/piper-tts/models
   */
  async getModels(req: Request, res: Response): Promise<void> {
    try {
      const models = await this.piperService.getAvailableModels();
      
      res.json({
        success: true,
        models,
        count: models.length
      });
    } catch (error: any) {
      console.error('Failed to get voice models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get voice models',
        details: error.message
      });
    }
  }

  /**
   * Download default voice models
   * POST /api/piper-tts/download-models
   */
  async downloadModels(req: Request, res: Response): Promise<void> {
    try {
      await this.piperService.downloadDefaultModel();
      
      res.json({
        success: true,
        message: 'Default voice models downloaded successfully'
      });
    } catch (error: any) {
      console.error('Failed to download voice models:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download voice models',
        details: error.message
      });
    }
  }

  /**
   * Get TTS service status
   * GET /api/piper-tts/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const models = await this.piperService.getAvailableModels();
      
      res.json({
        success: true,
        status: {
          initialized: true,
          modelsAvailable: models.length,
          models: models.map((m: any) => ({
            id: m.id,
            language: m.language,
            quality: m.quality
          }))
        }
      });
    } catch (error: any) {
      console.error('Failed to get TTS status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get TTS status',
        details: error.message
      });
    }
  }

  /**
   * Stop current TTS process
   * POST /api/piper-tts/stop
   */
  async stop(req: Request, res: Response): Promise<void> {
    try {
      await this.piperService.stop();
      
      res.json({
        success: true,
        message: 'TTS process stopped successfully'
      });
    } catch (error: any) {
      console.error('Failed to stop TTS process:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop TTS process',
        details: error.message
      });
    }
  }

  /**
   * Cleanup TTS resources
   * POST /api/piper-tts/cleanup
   */
  async cleanup(req: Request, res: Response): Promise<void> {
    try {
      await this.piperService.cleanup();
      
      res.json({
        success: true,
        message: 'TTS resources cleaned up successfully'
      });
    } catch (error: any) {
      console.error('Failed to cleanup TTS resources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup TTS resources',
        details: error.message
      });
    }
  }

  /**
   * Test TTS with sample text
   * POST /api/piper-tts/test
   */
  async test(req: Request, res: Response): Promise<void> {
    try {
      const sampleTexts = [
        'Olá! Este é um teste do sistema de síntese de voz Piper TTS.',
        'Hello! This is a test of the Piper TTS voice synthesis system.',
        'Bonjour! Ceci est un test du système de synthèse vocale Piper TTS.'
      ];

      const { language = 'pt' } = req.query;
      let testText = sampleTexts[0]; // Default to Portuguese

      if (language === 'en') testText = sampleTexts[1];
      if (language === 'fr') testText = sampleTexts[2];

      const audioBuffer = await this.piperService.textToSpeech(testText);

      // Set appropriate headers for audio response
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="test_speech.wav"');

      res.send(audioBuffer);
    } catch (error: any) {
      console.error('Failed to test TTS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test TTS',
        details: error.message
      });
    }
  }

  /**
   * Stream audio for real-time TTS
   * POST /api/piper-tts/stream
   */
  async stream(req: Request, res: Response): Promise<void> {
    try {
      const { text, options = {} } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Text is required and must be a string'
        });
        return;
      }

      // Set headers for streaming audio
      res.setHeader('Content-Type', 'audio/raw');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');

      const audioBuffer = await this.piperService.textToSpeech(text, options);
      
      // Stream the audio in chunks for real-time playback
      const chunkSize = 4096;
      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, i + chunkSize);
        res.write(chunk);
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      res.end();
    } catch (error: any) {
      console.error('Failed to stream TTS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stream TTS',
        details: error.message
      });
    }
  }
} 