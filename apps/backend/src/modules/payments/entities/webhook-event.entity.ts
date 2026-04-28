import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum WebhookSource {
  CINETPAY = 'CINETPAY',
}

export enum WebhookEventType {
  PAYMENT_NOTIFICATION = 'PAYMENT_NOTIFICATION',
  TRANSFER_NOTIFICATION = 'TRANSFER_NOTIFICATION',
}

export enum WebhookProcessingStatus {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  REJECTED_SIGNATURE = 'REJECTED_SIGNATURE',
  REJECTED_DUPLICATE = 'REJECTED_DUPLICATE',
  ERROR = 'ERROR',
}

/**
 * Webhook event log — append-only.
 *
 * Every incoming webhook is logged here BEFORE we touch any wallet. This serves:
 *  1. Idempotency — if we've seen this event id before, skip it
 *  2. Forensic replay — we can re-process old webhooks if our handler had a bug
 *  3. Compliance — proof of what was received from the provider
 */
@Entity('webhook_events')
@Index(['source', 'externalEventId'], { unique: true })
@Index(['processingStatus', 'createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: WebhookSource })
  source!: WebhookSource;

  @Column({ name: 'event_type', type: 'enum', enum: WebhookEventType })
  eventType!: WebhookEventType;

  @Column({ name: 'external_event_id', type: 'varchar', length: 200 })
  externalEventId!: string;

  @Column({ name: 'signature_provided', type: 'text', nullable: true })
  signatureProvided?: string | null;

  @Column({ name: 'signature_valid', type: 'boolean', nullable: true })
  signatureValid?: boolean | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    name: 'processing_status',
    type: 'enum',
    enum: WebhookProcessingStatus,
    default: WebhookProcessingStatus.RECEIVED,
  })
  processingStatus!: WebhookProcessingStatus;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
