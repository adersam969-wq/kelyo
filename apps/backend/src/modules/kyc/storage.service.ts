import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHmac } from 'crypto';

/**
 * Storage service for KYC documents.
 *
 * Uses MinIO in dev (S3-compatible) — same code works against AWS S3 in prod.
 * Documents go to a private bucket. Access is via short-lived presigned URLs
 * issued only to admins reviewing the document.
 *
 * NOTE: For Phase 1 we keep this minimal — full AWS SDK integration in Phase 2.
 * For now we just generate storage keys and persist metadata; actual binary
 * upload happens via direct PUT to MinIO using a presigned URL the client gets.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Generate a unique storage key for a new upload.
   * Filename never contains user data — pure UUID.
   */
  generateKey(userId: string, docType: string, mimeType: string): string {
    const ext = this.extFromMime(mimeType);
    return `kyc/${userId.slice(0, 2)}/${userId}/${docType.toLowerCase()}-${randomUUID()}${ext}`;
  }

  /**
   * Build a presigned PUT URL for the client to upload the file directly.
   * Stub implementation — real one uses @aws-sdk/s3-request-presigner.
   */
  async presignUpload(key: string, mimeType: string, ttlSeconds = 300): Promise<string> {
    const endpoint = process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000';
    const bucket = process.env.STORAGE_BUCKET ?? 'kelyo-kyc';
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    // Simplified token — real S3 v4 signing in Phase 2 with @aws-sdk
    const token = createHmac('sha256', process.env.STORAGE_SECRET_KEY ?? 'dev')
      .update(`${key}|${mimeType}|${expiresAt}`)
      .digest('hex');
    return `${endpoint}/${bucket}/${key}?expires=${expiresAt}&signature=${token}`;
  }

  /**
   * Build a short-lived GET URL for an admin to download the document.
   */
  async presignDownload(key: string, ttlSeconds = 300): Promise<string> {
    const endpoint = process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000';
    const bucket = process.env.STORAGE_BUCKET ?? 'kelyo-kyc';
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = createHmac('sha256', process.env.STORAGE_SECRET_KEY ?? 'dev')
      .update(`get|${key}|${expiresAt}`)
      .digest('hex');
    return `${endpoint}/${bucket}/${key}?expires=${expiresAt}&signature=${token}`;
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '';
  }
}
