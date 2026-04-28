import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Audit log — APPEND-ONLY. No updates, no deletes.
 * Production: revoke UPDATE/DELETE privileges on this table from app DB user.
 */
@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 100, nullable: true })
  resourceType?: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 100, nullable: true })
  resourceId?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  before!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  after!: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
