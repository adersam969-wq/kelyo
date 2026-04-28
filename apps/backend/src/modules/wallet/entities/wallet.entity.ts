import { Check, Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

/**
 * Wallet — one per user.
 *
 * Database invariants (enforced via CHECK constraints):
 *  - balance >= 0
 *  - available_balance >= 0
 *  - available_balance <= balance (holds cannot exceed total)
 *
 * Application invariant (verified by nightly job):
 *  - SUM(ledger_entries.amount WHERE wallet_id = X) = wallet.balance
 */
@Entity('wallets')
@Check('"balance" >= 0')
@Check('"available_balance" >= 0')
@Check('"available_balance" <= "balance"')
export class Wallet extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 3, default: 'XAF' })
  currency!: string;

  /**
   * Total balance in smallest currency unit (XAF integer).
   * Stored as bigint string in TypeORM — convert via transformer.
   */
  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  balance!: number;

  @Column({
    name: 'available_balance',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  availableBalance!: number;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status!: WalletStatus;
}
