import { desktopCapturer, BrowserWindow, NativeImage } from 'electron';
import { ITool, ToolExecutionContext, ToolExecutionResult, ToolParameterSchema, ToolMetadata, ToolCategory } from '../interfaces/ITool.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { showScreenshotSelector } from '../../../screenshotWindow.js';

interface CaptureScreenshotInput {
  displayId?: string; // Optional: specific display to capture
  region?: { // Optional: specific region to capture
    x: number;
    y: number;
    width: number;
    height: number;
  };
  outputPath?: string; // Optional: custom save location
  useSelector?: boolean; // Optional: use the area selection UI
}

interface CaptureScreenshotOutput {
  imagePath: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Tool for capturing screenshots of specific areas of the screen
 */
export class Tool_CaptureScreenshot implements ITool<CaptureScreenshotInput, CaptureScreenshotOutput> {
  public name = 'Tool_CaptureScreenshot';
  public description = 'Captures a screenshot of a specific area of the screen.';

  public inputSchema: Record<string, ToolParameterSchema> = {
    displayId: {
      type: 'string',
      description: 'Optional display ID to capture from. If not provided, the primary display will be used.',
      required: false
    },
    region: {
      type: 'object',
      description: 'Specific region to capture (x, y, width, height)',
      required: false,
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        width: { type: 'number', description: 'Width of region' },
        height: { type: 'number', description: 'Height of region' }
      }
    },
    outputPath: {
      type: 'string',
      description: 'Optional path where the screenshot should be saved. If not provided, a default path will be used.',
      required: false
    },
    useSelector: {
      type: 'boolean',
      description: 'Whether to use the area selection UI',
      required: false
    }
  };

  public outputExample: CaptureScreenshotOutput = {
    imagePath: '/path/to/screenshot.png',
    timestamp: '2024-01-01T00:00:00.000Z',
    success: true
  };

  public metadata: ToolMetadata = {
    version: '1.0.0',
    category: 'screen-capture',
    tags: ['screenshot', 'capture', 'screen']
  };

  private readonly tempDir: string;

  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'openhud-screenshots');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  public validateInput(input: CaptureScreenshotInput): { isValid: boolean; errors?: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> } {
    const errors: Array<{ parameter: string; message: string; receivedType?: string; expectedType?: string; }> = [];

    if (input.region) {
      const { x, y, width, height } = input.region;
      if (typeof x !== 'number' || typeof y !== 'number' || 
          typeof width !== 'number' || typeof height !== 'number') {
        errors.push({
          parameter: 'region',
          message: 'Region coordinates must be numbers',
          receivedType: `x: ${typeof x}, y: ${typeof y}, width: ${typeof width}, height: ${typeof height}`,
          expectedType: 'number'
        });
      }
      if (width <= 0 || height <= 0) {
        errors.push({
          parameter: 'region',
          message: 'Region width and height must be positive numbers',
          receivedType: `width: ${width}, height: ${height}`,
          expectedType: 'positive number'
        });
      }
    }

    if (input.outputPath && typeof input.outputPath !== 'string') {
      errors.push({
        parameter: 'outputPath',
        message: 'Output path must be a string',
        receivedType: typeof input.outputPath,
        expectedType: 'string'
      });
    }

    if (input.useSelector !== undefined && typeof input.useSelector !== 'boolean') {
      errors.push({
        parameter: 'useSelector',
        message: 'useSelector must be a boolean',
        receivedType: typeof input.useSelector,
        expectedType: 'boolean'
      });
    }

    if (input.displayId && typeof input.displayId !== 'string') {
      errors.push({
        parameter: 'displayId',
        message: 'Display ID must be a string',
        receivedType: typeof input.displayId,
        expectedType: 'string'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Execute the screenshot capture
   */
  public async execute(input: CaptureScreenshotInput, context: ToolExecutionContext): Promise<ToolExecutionResult<CaptureScreenshotOutput>> {
    try {
      const validation = this.validateInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input parameters',
            details: validation.errors
          }
        };
      }

      // If useSelector is true, get the region from the selector UI
      let region = input.region;
      if (input.useSelector) {
        try {
          region = await showScreenshotSelector();
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'SELECTION_CANCELLED',
              message: 'Screenshot selection was cancelled',
              details: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      }

      // Get available displays
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const source = input.displayId
        ? sources.find(s => s.id === input.displayId)
        : sources[0];

      if (!source) {
        return {
          success: false,
          error: {
            code: 'DISPLAY_NOT_FOUND',
            message: 'No valid display found'
          }
        };
      }

      // Get screenshot as NativeImage
      const thumbnail = source.thumbnail;
      if (!thumbnail) {
        return {
          success: false,
          error: {
            code: 'CAPTURE_FAILED',
            message: 'Failed to capture screenshot'
          }
        };
      }

      // Process region if specified
      let finalImage: NativeImage = thumbnail;
      if (region) {
        finalImage = thumbnail.crop(region);
      }

      // Determine output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = input.outputPath || path.join(this.tempDir, `screenshot-${timestamp}.png`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save screenshot
      await fs.promises.writeFile(outputPath, finalImage.toPNG());

      return {
        success: true,
        data: {
          imagePath: outputPath,
          timestamp: timestamp,
          success: true
        }
      };
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

  public async dispose(): Promise<void> {
    // Clean up temporary directory if it exists
    if (fs.existsSync(this.tempDir)) {
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  public async healthCheck(): Promise<{ healthy: boolean; details?: any }> {
    try {
      // Check if we can access the temp directory
      await fs.promises.access(this.tempDir);
      
      // Try to list displays
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }
      });

      return {
        healthy: sources.length > 0,
        details: {
          tempDirAccessible: true,
          availableDisplays: sources.length
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          tempDirAccessible: false
        }
      };
    }
  }
} 