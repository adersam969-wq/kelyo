import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LedgerAccount, LedgerDirection, LedgerEntry } from './entities/ledger-entry.entity';
import { Wallet, WalletStatus } from './entities/wallet.entity';
import { assertValidAmount } from '../../common/utils/money';

export interface LedgerLine {
  account: LedgerAccount;
  direction: LedgerDirection;
  amount: number;
  walletId?: string | null;
  memo?: string;
}

/**
 * Posts a multi-line ledger entry for a single transaction.
 *
 * INVARIANTS (enforced here):
 *  1. SUM(DEBIT amounts) === SUM(CREDIT amounts)  → no money created/destroyed
 *  2. All amounts are positive integers
 *  3. All entries share the same currency
 *  4. Wallet balances are updated under SELECT … FOR UPDATE (caller must use this service inside a transaction)
 *
 * Wallet balance convention:
 *   CREDIT  to a wallet → balance += amount
 *   DEBIT   from a wallet → balance -= amount
 *
 * The `manager` MUST be a transactional EntityManager (caller wraps in dataSource.transaction).
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  /**
   * Post a balanced set of ledger lines for a transaction.
   * Returns the created LedgerEntry rows.
   */
  async post(
    manager: EntityManager,
    transactionId: string,
    lines: LedgerLine[],
    currency = 'XAF',
  ): Promise<LedgerEntry[]> {
    if (!lines || lines.length < 2) {
      throw new BadRequestException('Ledger entry must contain at least 2 lines');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      assertValidAmount(line.amount);
      if (line.direction === LedgerDirection.DEBIT) totalDebit += line.amount;
      else totalCredit += line.amount;
    }

    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Ledger entries unbalanced: debit=${totalDebit} credit=${totalCredit}`,
      );
    }

    // Group lines by walletId to apply each wallet update once
    const walletDeltas = new Map<string, number>();
    for (const line of lines) {
      if (!line.walletId) continue;
      const delta = line.direction === LedgerDirection.CREDIT ? line.amount : -line.amount;
      walletDeltas.set(line.walletId, (walletDeltas.get(line.walletId) ?? 0) + delta);
    }

    // Apply wallet updates with pessimistic lock (SELECT FOR UPDATE)
    for (const [walletId, delta] of walletDeltas.entries()) {
      const wallet = await manager
        .getRepository(Wallet)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id', { id: walletId })
        .getOne();

      if (!wallet) {
        throw new BadRequestException(`Wallet ${walletId} not found`);
      }
      if (wallet.status !== WalletStatus.ACTIVE) {
        throw new BadRequestException(`Wallet ${walletId} is not active (status: ${wallet.status})`);
      }
      if (wallet.currency !== currency) {
        throw new BadRequestException(
          `Currency mismatch: wallet ${walletId} is ${wallet.currency}, entry is ${currency}`,
        );
      }

      const newBalance = wallet.balance + delta;
      const newAvailable = wallet.availableBalance + delta;

      if (newBalance < 0 || newAvailable < 0) {
        throw new BadRequestException(
          `Insufficient balance on wallet ${walletId} (current=${wallet.balance}, delta=${delta})`,
        );
      }

      await manager.getRepository(Wallet).update(
        { id: walletId },
        { balance: newBalance, availableBalance: newAvailable },
      );
    }

    // Insert ledger entries (append-only — DB triggers prevent updates/deletes)
    const entries = lines.map((line) =>
      manager.getRepository(LedgerEntry).create({
        transactionId,
        account: line.account,
        direction: line.direction,
        walletId: line.walletId ?? null,
        amount: line.amount,
        currency,
        memo: line.memo ?? null,
      }),
    );
    const saved = await manager.getRepository(LedgerEntry).save(entries);

    this.logger.log(
      `Ledger posted: tx=${transactionId} lines=${lines.length} amount=${totalDebit} ${currency}`,
    );
    return saved;
  }

  /**
   * Audit query — recompute a wallet balance from ledger and compare with stored balance.
   * Used by the nightly invariant-check job.
   */
  async computeWalletBalanceFromLedger(
    manager: EntityManager,
    walletId: string,
  ): Promise<number> {
    const result = await manager
      .getRepository(LedgerEntry)
      .createQueryBuilder('le')
      .select(
        `COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END), 0)`,
        'sum',
      )
      .where('le.wallet_id = :walletId', { walletId })
      .getRawOne<{ sum: string }>();

    return parseInt(result?.sum ?? '0', 10);
  }
}
