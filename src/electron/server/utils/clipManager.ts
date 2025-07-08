import path from 'path';
import fs from 'fs';
import { app } from 'electron';

interface ClipMetadata {
  id: string;
  timestamp: string;
  duration: number;
  quality: string;
  size: number;
  trigger?: string;
  gameContext?: {
    map?: string;
    score?: string;
    event?: string;
  };
}

interface ClipManagerConfig {
  maxStorageGB?: number;
  maxClipDuration?: number;
  retentionDays?: number;
  defaultQuality?: 'low' | 'medium' | 'high';
  autoCleanup?: boolean;
}

/**
 * Clip manager utility class
 */
export class ClipManager {
  private static instance: ClipManager;
  private readonly clipsDir: string;
  private readonly metadataFile: string;
  private readonly tempDir: string;
  private metadata: Map<string, ClipMetadata>;
  private config: Required<ClipManagerConfig>;

  private constructor() {
    // Set up directories
    this.clipsDir = path.join(app.getPath('userData'), 'clips');
    this.tempDir = path.join(app.getPath('temp'), 'cs2-coach-ai-clips');
    this.metadataFile = path.join(this.clipsDir, 'metadata.json');

    // Create directories if they don't exist
    for (const dir of [this.clipsDir, this.tempDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Default configuration
    this.config = {
      maxStorageGB: 10,
      maxClipDuration: 30,
      retentionDays: 30,
      defaultQuality: 'medium',
      autoCleanup: true
    };

    // Load metadata
    this.metadata = new Map();
    this.loadMetadata();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ClipManager {
    if (!ClipManager.instance) {
      ClipManager.instance = new ClipManager();
    }
    return ClipManager.instance;
  }

  /**
   * Configure clip manager
   */
  public configure(config: ClipManagerConfig): void {
    this.config = {
      ...this.config,
      ...config
    };

    // Run cleanup if auto-cleanup is enabled
    if (this.config.autoCleanup) {
      this.cleanup().catch(console.error);
    }
  }

  /**
   * Save clip from temporary file
   */
  public async saveClip(
    tempPath: string,
    metadata: Omit<ClipMetadata, 'id' | 'timestamp' | 'size'>
  ): Promise<ClipMetadata | null> {
    try {
      // Generate clip ID and timestamp
      const timestamp = new Date().toISOString();
      const id = `clip_${timestamp.replace(/[:.]/g, '-')}_${Math.random().toString(36).substr(2, 9)}`;

      // Get file stats
      const stats = await fs.promises.stat(tempPath);

      // Check file size
      const sizeGB = stats.size / (1024 * 1024 * 1024);
      if (sizeGB > this.config.maxStorageGB) {
        throw new Error(`Clip size (${sizeGB.toFixed(2)}GB) exceeds maximum storage limit (${this.config.maxStorageGB}GB)`);
      }

      // Generate final path
      const finalPath = path.join(this.clipsDir, `${id}.mp4`);

      // Move file from temp to clips directory
      await fs.promises.rename(tempPath, finalPath);

      // Create metadata
      const clipMetadata: ClipMetadata = {
        id,
        timestamp,
        size: stats.size,
        ...metadata
      };

      // Save metadata
      this.metadata.set(id, clipMetadata);
      await this.saveMetadata();

      return clipMetadata;

    } catch (error) {
      console.error('Failed to save clip:', error);
      return null;
    }
  }

  /**
   * Get clip metadata
   */
  public getClipMetadata(id: string): ClipMetadata | null {
    return this.metadata.get(id) || null;
  }

  /**
   * Get all clips metadata
   */
  public getAllClipsMetadata(): ClipMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Delete clip
   */
  public async deleteClip(id: string): Promise<boolean> {
    try {
      const metadata = this.metadata.get(id);
      if (!metadata) {
        return false;
      }

      // Delete file
      const filePath = path.join(this.clipsDir, `${id}.mp4`);
      await fs.promises.unlink(filePath);

      // Remove metadata
      this.metadata.delete(id);
      await this.saveMetadata();

      return true;

    } catch (error) {
      console.error('Failed to delete clip:', error);
      return false;
    }
  }

  /**
   * Get clip file path
   */
  public getClipPath(id: string): string | null {
    const metadata = this.metadata.get(id);
    if (!metadata) {
      return null;
    }

    const filePath = path.join(this.clipsDir, `${id}.mp4`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * Get temporary directory path
   */
  public getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Get clips directory path
   */
  public getClipsDir(): string {
    return this.clipsDir;
  }

  /**
   * Get storage usage
   */
  public async getStorageUsage(): Promise<{
    totalSizeGB: number;
    clipCount: number;
    oldestClip: string;
    newestClip: string;
  }> {
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;

    for (const metadata of this.metadata.values()) {
      totalSize += metadata.size;
      const timestamp = new Date(metadata.timestamp).getTime();
      oldestTimestamp = Math.min(oldestTimestamp, timestamp);
      newestTimestamp = Math.max(newestTimestamp, timestamp);
    }

    return {
      totalSizeGB: totalSize / (1024 * 1024 * 1024),
      clipCount: this.metadata.size,
      oldestClip: new Date(oldestTimestamp).toISOString(),
      newestClip: new Date(newestTimestamp).toISOString()
    };
  }

  /**
   * Clean up old clips and temporary files
   */
  public async cleanup(): Promise<void> {
    try {
      // Clean up temporary directory
      const tempFiles = await fs.promises.readdir(this.tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(this.tempDir, file);
        await fs.promises.unlink(filePath);
      }

      // Get current storage usage
      const { totalSizeGB } = await this.getStorageUsage();

      // If storage usage exceeds limit, delete oldest clips
      if (totalSizeGB > this.config.maxStorageGB) {
        const excessGB = totalSizeGB - this.config.maxStorageGB;
        const clips = Array.from(this.metadata.values())
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let freedGB = 0;
        for (const clip of clips) {
          if (freedGB >= excessGB) {
            break;
          }
          await this.deleteClip(clip.id);
          freedGB += clip.size / (1024 * 1024 * 1024);
        }
      }

      // Delete clips older than retention period
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);

      for (const metadata of this.metadata.values()) {
        const clipDate = new Date(metadata.timestamp);
        if (clipDate < retentionDate) {
          await this.deleteClip(metadata.id);
        }
      }

    } catch (error) {
      console.error('Failed to clean up clips:', error);
    }
  }

  /**
   * Load metadata from file
   */
  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf8');
        const entries = JSON.parse(data);
        this.metadata = new Map(entries);
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
      this.metadata = new Map();
    }
  }

  /**
   * Save metadata to file
   */
  private async saveMetadata(): Promise<void> {
    try {
      const entries = Array.from(this.metadata.entries());
      await fs.promises.writeFile(this.metadataFile, JSON.stringify(entries, null, 2));
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }
} 