import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum WithdrawalStatus {
  PENDING_PIN = 'PENDING_PIN',         // created, waiting for PIN confirmation
  PENDING = 'PENDING',                  // PIN OK, debited from wallet, awaiting CinetPay
  PROCESSING = 'PROCESSING',            // CinetPay accepted, transfer in flight
  COMPLETED = 'COMPLETED',              // money delivered to recipient
  FAILED = 'FAILED',                    // CinetPay refused — wallet refunded
  REVERSED = 'REVERSED',                // succeeded then refunded for some reason
  EXPIRED = 'EXPIRED',                  // PIN never confirmed in time, no debit happened
}

export enum WithdrawalChannel {
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
}

/**
 * Withdrawal — tracks a payout from a Kelyo wallet to an external Mobile Money account.
 *
 * State machine:
 *   PENDING_PIN ──(user enters PIN)──▶ PENDING ──(CinetPay accepts)──▶ PROCESSING
 *        │                                │                                  │
 *        ▼                                ▼                                  ├─▶ COMPLETED
 *     EXPIRED                          FAILED                                │
 *   (wallet untouched)             (wallet refunded)                         └─▶ FAILED (refunded)
 *
 * Linked 1-to-1 with a Transaction row that owns the ledger entries.
 */
@Entity('withdrawals')
@Index(['userId', 'createdAt'])
@Index(['status'])
@Index(['cinetpayTransactionId'], { unique: true, where: '"cinetpay_transaction_id" IS NOT NULL' })
export class Withdrawal extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null;

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

  @Column({ type: 'enum', enum: WithdrawalChannel })
  channel!: WithdrawalChannel;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 20 })
  recipientPhone!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 200, nullable: true })
  recipientName?: string | null;

  @Column({ type: 'enum', enum: WithdrawalStatus, default: WithdrawalStatus.PENDING_PIN })
  status!: WithdrawalStatus;

  @Column({ name: 'cinetpay_transaction_id', type: 'varchar', length: 100, nullable: true })
  cinetpayTransactionId?: string | null;

  @Column({ name: 'pin_expires_at', type: 'timestamptz', nullable: true })
  pinExpiresAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt?: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;
}
