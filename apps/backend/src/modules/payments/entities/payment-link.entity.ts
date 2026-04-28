import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum PaymentLinkStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('payment_links')
@Index(['slug'], { unique: true })
@Index(['merchantId', 'status'])
export class PaymentLink extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  slug!: string;

  @Column({
    type: 'bigint',
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseInt(v, 10),
    },
  })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: PaymentLinkStatus, default: PaymentLinkStatus.ACTIVE })
  status!: PaymentLinkStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @Column({ name: 'paid_by_user_id', type: 'uuid', nullable: true })
  paidByUserId?: string | null;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null;
}
