import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (err) {
      this.logger.error('Failed to create upload directory', err);
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string; filename: string; size: number }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Check if S3 is configured
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
    if (s3Endpoint) {
      return this.uploadToS3(file);
    }

    // Local storage fallback
    return this.uploadLocal(file);
  }

  private async uploadLocal(file: Express.Multer.File) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    await fs.writeFile(filepath, file.buffer);

    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const url = `${appUrl}/uploads/${filename}`;

    this.logger.log(`File uploaded locally: ${filename}`);

    return {
      url,
      filename,
      size: file.size,
    };
  }

  private async uploadToS3(file: Express.Multer.File) {
    // S3-compatible upload implementation
    // Uses S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
    //
    // In production, use @aws-sdk/client-s3:
    //
    // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    // const s3 = new S3Client({
    //   region: this.configService.get('S3_REGION'),
    //   endpoint: this.configService.get('S3_ENDPOINT'),
    //   credentials: {
    //     accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
    //     secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY'),
    //   },
    //   forcePathStyle: this.configService.get('S3_FORCE_PATH_STYLE') === 'true',
    // });
    //
    // const key = `uploads/${Date.now()}-${file.originalname}`;
    // await s3.send(new PutObjectCommand({
    //   Bucket: this.configService.get('S3_BUCKET'),
    //   Key: key,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    // }));
    // const url = `${this.configService.get('S3_ENDPOINT')}/${this.configService.get('S3_BUCKET')}/${key}`;

    this.logger.warn('S3 upload not yet implemented, falling back to local storage');
    return this.uploadLocal(file);
  }

  async deleteFile(filename: string): Promise<void> {
    const filepath = path.join(this.uploadDir, filename);
    try {
      await fs.unlink(filepath);
      this.logger.log(`File deleted: ${filename}`);
    } catch (err) {
      this.logger.warn(`Failed to delete file ${filename}: ${err}`);
    }
  }
}
