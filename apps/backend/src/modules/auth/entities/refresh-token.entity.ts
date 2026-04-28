import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Refresh token with rotation + reuse detection.
 *
 * On every refresh:
 *  1. Mark current token as used (set `used_at`)
 *  2. Issue a new token with the SAME `family_id`
 *
 * If a token that's already `used` is presented again → REUSE DETECTED.
 * Action: revoke the entire family (all tokens with that family_id).
 * This logs the user out everywhere and forces re-authentication.
 */
@Entity('refresh_tokens')
@Index(['userId', 'familyId'])
@Index(['tokenHash'], { unique: true })
export class RefreshToken extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true })
  replacedById?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;
}
