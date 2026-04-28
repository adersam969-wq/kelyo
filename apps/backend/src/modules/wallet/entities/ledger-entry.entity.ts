import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum LedgerAccount {
  USER_WALLET = 'USER_WALLET',
  CINETPAY_CLEARING = 'CINETPAY_CLEARING',
  KELYO_FEES = 'KELYO_FEES',
  KELYO_REVENUE = 'KELYO_REVENUE',
  EXTERNAL_AIRTEL = 'EXTERNAL_AIRTEL',
  EXTERNAL_MOOV = 'EXTERNAL_MOOV',
  EXTERNAL_CARD = 'EXTERNAL_CARD',
  SUSPENSE = 'SUSPENSE',
}

export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/**
 * Ledger entry — APPEND-ONLY. Never updated, never deleted.
 *
 * Every transaction produces at least 2 entries that sum to zero:
 *   - Top-up of 25 000 XAF from Airtel:
 *       DEBIT  EXTERNAL_AIRTEL  25 000
 *       CREDIT USER_WALLET      25 000
 *
 * The `transaction_id` groups entries belonging to the same business event.
 * The `wallet_id` is set when the entry affects a Kelyo wallet (for fast lookups).
 *
 * Sign convention: amount is always positive; direction tells you DEBIT vs CREDIT.
 * For wallet sums, CREDIT is +amount, DEBIT is -amount.
 */
@Entity('ledger_entries')
@Check('"amount" > 0')
@Index(['transactionId'])
@Index(['walletId', 'createdAt'])
@Index(['account', 'createdAt'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ type: 'enum', enum: LedgerAccount })
  account!: LedgerAccount;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction!: LedgerDirection;

  @Column({ name: 'wallet_id', type: 'uuid', nullable: true })
  walletId?: string | null;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  memo?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
