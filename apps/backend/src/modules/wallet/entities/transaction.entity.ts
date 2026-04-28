import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Wallet } from './wallet.entity';

export enum TransactionType {
  TOPUP = 'TOPUP',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  PAYMENT = 'PAYMENT',
  COLLECTION = 'COLLECTION',
  FEE = 'FEE',
  REVERSAL = 'REVERSAL',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
}

export enum PaymentChannel {
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  CARD_VISA = 'CARD_VISA',
  CARD_MASTERCARD = 'CARD_MASTERCARD',
  KELYO_WALLET = 'KELYO_WALLET',
}

@Entity('transactions')
@Index(['walletId', 'createdAt'])
@Index(['status'])
@Index(['externalRef'], { unique: true, where: '"external_ref" IS NOT NULL' })
export class Transaction extends BaseEntity {
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet?: Wallet;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Column({
    type: 'bigint',
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseInt(v, 10),
    },
  })
  amount!: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseInt(v, 10),
    },
  })
  fee!: number;

  @Column({ type: 'varchar', length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentChannel, nullable: true })
  channel?: PaymentChannel | null;

  @Column({ name: 'counterparty_name', type: 'varchar', length: 200, nullable: true })
  counterpartyName?: string | null;

  @Column({ name: 'counterparty_phone', type: 'varchar', length: 20, nullable: true })
  counterpartyPhone?: string | null;

  @Column({ name: 'counterparty_wallet_id', type: 'uuid', nullable: true })
  counterpartyWalletId?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'external_ref', type: 'varchar', length: 100, nullable: true })
  externalRef?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt?: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;
}
