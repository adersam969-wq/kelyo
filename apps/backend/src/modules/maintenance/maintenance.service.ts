import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { OtpService } from '../auth/otp.service';
import { IdempotencyKey } from '../../common/entities/idempotency-key.entity';
import { LedgerService } from '../wallet/ledger.service';
import { Wallet } from '../wallet/entities/wallet.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly otp: OtpService,
    @InjectRepository(IdempotencyKey)
    private readonly idem: Repository<IdempotencyKey>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOtps() {
    const removed = await this.otp.cleanup();
    if (removed > 0) this.logger.log(`Cleaned up ${removed} expired OTPs`);
  }

  /**
   * Idempotency keys older than 24h can be deleted.
   * Replays after 24h are safe to re-execute (the typical retry window is seconds, not days).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupIdempotencyKeys() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.idem.delete({ createdAt: LessThan(cutoff) });
    if (result.affected) {
      this.logger.log(`Cleaned up ${result.affected} expired idempotency keys`);
    }
  }

  /**
   * Nightly invariant check: for each wallet, verify that the stored balance
   * equals the sum of ledger entries. Mismatch → log critical error + alert.
   *
   * In production, a mismatch should:
   *   1. Page on-call engineer
   *   2. Freeze the affected wallet automatically
   *   3. Trigger a forensic dump of recent transactions
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async verifyLedgerInvariants() {
    this.logger.log('Starting nightly ledger invariant check…');
    const wallets = await this.wallets.find();
    let ok = 0;
    let mismatches = 0;

    for (const wallet of wallets) {
      const computed = await this.ledger.computeWalletBalanceFromLedger(
        this.dataSource.manager,
        wallet.id,
      );
      if (computed !== wallet.balance) {
        mismatches++;
        this.logger.error(
          `🚨 LEDGER MISMATCH: wallet=${wallet.id} stored=${wallet.balance} computed=${computed}`,
        );
      } else {
        ok++;
      }
    }
    this.logger.log(`Ledger check complete: ${ok} OK, ${mismatches} mismatches`);
  }
}
