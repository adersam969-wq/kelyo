import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  KycDocument,
  KycDocumentStatus,
  KycDocumentType,
} from './entities/kyc-document.entity';
import { KycStatus, KycTier, User } from '../users/entities/user.entity';
import { StorageService } from './storage.service';

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Tier requirements:
 *  - TIER_1: ID_CARD_FRONT + ID_CARD_BACK (or PASSPORT) — all APPROVED
 *  - TIER_2: TIER_1 + SELFIE + PROOF_OF_ADDRESS — all APPROVED
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @InjectRepository(KycDocument) private readonly docs: Repository<KycDocument>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Step 1 — client requests an upload URL.
   * Returns the presigned PUT URL and the storageKey to use when confirming.
   */
  async requestUploadUrl(input: {
    userId: string;
    docType: KycDocumentType;
    mimeType: string;
    sizeBytes: number;
  }) {
    if (!ALLOWED_MIMES.includes(input.mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);
    }
    if (input.sizeBytes > MAX_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_BYTES} bytes)`);
    }

    const storageKey = this.storage.generateKey(input.userId, input.docType, input.mimeType);
    const uploadUrl = await this.storage.presignUpload(storageKey, input.mimeType);

    return { uploadUrl, storageKey, expiresInSeconds: 300 };
  }

  /**
   * Step 2 — client confirms the upload completed.
   * We persist the document metadata, set status PENDING for admin review,
   * and bump user's kycStatus to PENDING.
   */
  async confirmUpload(input: {
    userId: string;
    docType: KycDocumentType;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const doc = await manager.getRepository(KycDocument).save(
        manager.getRepository(KycDocument).create({
          userId: input.userId,
          docType: input.docType,
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          status: KycDocumentStatus.PENDING,
        }),
      );

      const user = await manager.getRepository(User).findOne({ where: { id: input.userId } });
      if (user && user.kycStatus !== KycStatus.PENDING) {
        await manager.getRepository(User).update(
          { id: input.userId },
          { kycStatus: KycStatus.PENDING },
        );
      }

      this.logger.log(`KYC doc submitted: user=${input.userId} type=${input.docType}`);
      return { documentId: doc.id, status: doc.status };
    });
  }

  /**
   * Admin: list pending documents.
   */
  async listPending(page = 1, pageSize = 20) {
    const [items, total] = await this.docs.findAndCount({
      where: { status: KycDocumentStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /**
   * Admin: review a document. On approval, recompute the user's tier.
   */
  async reviewDocument(input: {
    documentId: string;
    adminId: string;
    decision: 'APPROVE' | 'REJECT';
    rejectionReason?: string;
  }) {
    if (input.decision === 'REJECT' && !input.rejectionReason) {
      throw new BadRequestException('Rejection reason required');
    }

    return this.dataSource.transaction(async (manager) => {
      const doc = await manager.getRepository(KycDocument).findOne({
        where: { id: input.documentId },
      });
      if (!doc) throw new NotFoundException('Document not found');
      if (doc.status !== KycDocumentStatus.PENDING) {
        throw new BadRequestException('Document already reviewed');
      }

      await manager.getRepository(KycDocument).update(
        { id: doc.id },
        {
          status:
            input.decision === 'APPROVE'
              ? KycDocumentStatus.APPROVED
              : KycDocumentStatus.REJECTED,
          reviewedBy: input.adminId,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason ?? null,
        },
      );

      // Recompute user's tier and global KYC status
      await this.recomputeUserTier(manager, doc.userId);

      return { documentId: doc.id };
    });
  }

  /**
   * Recompute a user's KYC tier based on currently APPROVED documents.
   */
  private async recomputeUserTier(manager: any, userId: string) {
    const approved = await manager
      .getRepository(KycDocument)
      .find({ where: { userId, status: KycDocumentStatus.APPROVED } });

    const types = new Set(approved.map((d: KycDocument) => d.docType));
    const hasIdPair =
      (types.has(KycDocumentType.ID_CARD_FRONT) && types.has(KycDocumentType.ID_CARD_BACK)) ||
      types.has(KycDocumentType.PASSPORT);
    const hasSelfie = types.has(KycDocumentType.SELFIE);
    const hasProofOfAddress = types.has(KycDocumentType.PROOF_OF_ADDRESS);

    let newTier = KycTier.TIER_0;
    if (hasIdPair) newTier = KycTier.TIER_1;
    if (hasIdPair && hasSelfie && hasProofOfAddress) newTier = KycTier.TIER_2;

    // Global status: APPROVED if at least TIER_1, PENDING if any pending docs, otherwise current
    const pending = await manager
      .getRepository(KycDocument)
      .count({ where: { userId, status: KycDocumentStatus.PENDING } });

    let newStatus: KycStatus;
    if (newTier !== KycTier.TIER_0) newStatus = KycStatus.APPROVED;
    else if (pending > 0) newStatus = KycStatus.PENDING;
    else newStatus = KycStatus.NOT_SUBMITTED;

    await manager
      .getRepository(User)
      .update({ id: userId }, { kycTier: newTier, kycStatus: newStatus });

    this.logger.log(`KYC tier recomputed: user=${userId} → ${newTier} (${newStatus})`);
  }
}
