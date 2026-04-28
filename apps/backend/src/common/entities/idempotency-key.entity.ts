import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Idempotency key — composite primary key (key, user_id) prevents cross-user collisions.
 * Cleaned up by a cron job after 24h.
 */
@Entity('idempotency_keys')
@Index(['createdAt'])
export class IdempotencyKey {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ name: 'response_body', type: 'text' })
  responseBody!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
