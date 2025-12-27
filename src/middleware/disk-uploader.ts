import fs from 'fs';
import path from 'path';
import { Logger } from 'winston';
import config from '../config';

export interface IUploader {
  handleChunk(filePath: string): Promise<void>;
  finalize(): Promise<void>;
}

export class DiskUploader implements IUploader {
  private readonly meetingId: string;
  private readonly logger: Logger;
  private readonly baseDir: string;
  private readonly chunkDir: string;
  private chunkIndex = 0;

  constructor(meetingId: string, logger: Logger) {
    this.meetingId = meetingId;
    this.logger = logger;

    // /home/kali/Data/audio/<meetingId>
    this.baseDir = path.join(config.audioStoragePath, meetingId);
    this.chunkDir = path.join(this.baseDir, 'chunks');

    fs.mkdirSync(this.chunkDir, { recursive: true });

    this.logger.info('DiskUploader initialized', {
      baseDir: this.baseDir,
    });
  }

  /**
   * Called whenever a new audio chunk is produced
   * We STORE it locally (NO upload in dev)
   */
  async handleChunk(tempChunkPath: string): Promise<void> {
    if (!fs.existsSync(tempChunkPath)) {
      this.logger.warn('Chunk file missing, skipping', {
        tempChunkPath,
      });
      return;
    }

    const targetPath = path.join(
      this.chunkDir,
      `chunk-${String(this.chunkIndex).padStart(5, '0')}.wav`
    );

    try {
      fs.copyFileSync(tempChunkPath, targetPath);
      this.chunkIndex++;

      this.logger.info('Audio chunk saved', {
        targetPath,
      });
    } catch (err) {
      this.logger.error('Failed to save audio chunk', {
        tempChunkPath,
        targetPath,
        error: err,
      });
      throw err;
    }
  }

  /**
   * Called once when recording stops
   */
  async finalize(): Promise<void> {
    const metaPath = path.join(this.baseDir, 'meta.json');

    const meta = {
      meetingId: this.meetingId,
      completedAt: new Date().toISOString(),
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      chunks: this.chunkIndex,
    };

    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
      this.logger.info('Recording finalized', {
        metaPath,
        chunks: this.chunkIndex,
      });
    } catch (err) {
      this.logger.error('Failed to write meta.json', err);
    }
  }
}

export default DiskUploader;
