import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum KycDocumentType {
  ID_CARD_FRONT = 'ID_CARD_FRONT',
  ID_CARD_BACK = 'ID_CARD_BACK',
  PASSPORT = 'PASSPORT',
  SELFIE = 'SELFIE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
}

export enum KycDocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('kyc_documents')
@Index(['userId', 'docType'])
export class KycDocument extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'doc_type', type: 'enum', enum: KycDocumentType })
  docType!: KycDocumentType;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @Column({ type: 'enum', enum: KycDocumentStatus, default: KycDocumentStatus.PENDING })
  status!: KycDocumentStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;
}
