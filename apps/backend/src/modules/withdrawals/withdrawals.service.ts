import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThan } from 'typeorm';
import { Withdrawal, WithdrawalChannel, WithdrawalStatus } from './entities/withdrawal.entity';
import { User, KycTier } from '../users/entities/user.entity';
import { Wallet, WalletStatus } from '../wallet/entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentChannel,
} from '../wallet/entities/transaction.entity';
import { LedgerService } from '../wallet/ledger.service';
import { LedgerAccount, LedgerDirection } from '../wallet/entities/ledger-entry.entity';
import { CinetPayClient } from '../cinetpay/cinetpay.client';
import { PinService } from '../users/pin.service';
import { assertValidAmount } from '../../common/utils/money';

const PIN_TIMEOUT_SECONDS = 120;

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    @InjectRepository(Withdrawal) private readonly withdrawals: Repository<Withdrawal>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(Transaction) private readonly txs: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
    private readonly cinetpay: CinetPayClient,
    private readonly pin: PinService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1: User initiates a withdrawal.
   * Validates KYC limits, daily limits, and creates a PENDING_PIN withdrawal.
   * Wallet is NOT debited yet — that happens after PIN confirmation.
   */
  async initiate(input: {
    userId: string;
    amount: number;
    channel: WithdrawalChannel;
    recipientPhone: string;
    recipientName?: string;
  }): Promise<{ withdrawalId: string; pinExpiresInSeconds: number; fee: number }> {
    assertValidAmount(input.amount);

    if (!/^\+\d{8,15}$/.test(input.recipientPhone)) {
      throw new BadRequestException('Recipient phone must be in E.164 format');
    }

    const user = await this.users.findOne({ where: { id: input.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new ForbiddenException('Account disabled');

    // Check user has set a PIN
    const hasPin = await this.pin.hasPin(input.userId);
    if (!hasPin) {
      throw new BadRequestException('PIN_NOT_SET');
    }

    // Check KYC tier limits
    this.enforceKycLimits(user.kycTier, input.amount);

    // Check daily limit (sum of completed withdrawals + this one in last 24h)
    const dailyUsed = await this.computeDailyWithdrawn(input.userId);
    const dailyLimit = this.dailyLimitForTier(user.kycTier);
    if (dailyUsed + input.amount > dailyLimit) {
      throw new ForbiddenException(
        `Daily withdrawal limit reached. Used: ${dailyUsed}, limit: ${dailyLimit}`,
      );
    }

    // Compute fee (1% capped, free under 10000)
    const fee = this.computeFee(input.amount);
    const totalDebit = input.amount + fee;

    // Check wallet
    const wallet = await this.wallets.findOne({ where: { userId: input.userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new ForbiddenException('Wallet not active');
    }
    if (wallet.availableBalance < totalDebit) {
      throw new BadRequestException(
        `Insufficient balance. Need ${totalDebit}, have ${wallet.availableBalance}`,
      );
    }

    const w = await this.withdrawals.save(
      this.withdrawals.create({
        userId: input.userId,
        walletId: wallet.id,
        amount: input.amount,
        fee,
        currency: 'XAF',
        channel: input.channel,
        recipientPhone: input.recipientPhone,
        recipientName: input.recipientName ?? null,
        status: WithdrawalStatus.PENDING_PIN,
        pinExpiresAt: new Date(Date.now() + PIN_TIMEOUT_SECONDS * 1000),
      }),
    );

    this.logger.log(
      `Withdrawal initiated: id=${w.id} amount=${input.amount} fee=${fee} channel=${input.channel}`,
    );

    return { withdrawalId: w.id, pinExpiresInSeconds: PIN_TIMEOUT_SECONDS, fee };
  }

  /**
   * Step 2: User confirms with PIN.
   *  1. Verify PIN
   *  2. Debit the wallet inside a DB transaction (PENDING ledger entries)
   *  3. Call CinetPay to initiate the transfer
   *  4. If CinetPay accepts → status PROCESSING, wait for webhook
   *  5. If CinetPay refuses immediately → refund wallet, status FAILED
   */
  async confirmWithPin(
    userId: string,
    withdrawalId: string,
    pin: string,
  ): Promise<{ status: WithdrawalStatus; transactionId: string | null }> {
    // 1. Verify PIN (this also handles lockout)
    await this.pin.verifyPin(userId, pin);

    // 2. Lock and validate the withdrawal
    const w = await this.withdrawals.findOne({ where: { id: withdrawalId, userId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PENDING_PIN) {
      throw new BadRequestException(`Withdrawal is in state ${w.status}`);
    }
    if (w.pinExpiresAt && w.pinExpiresAt < new Date()) {
      await this.withdrawals.update({ id: w.id }, { status: WithdrawalStatus.EXPIRED });
      throw new BadRequestException('PIN confirmation expired. Please start over.');
    }

    // 3. Debit the wallet atomically
    let txId: string;
    try {
      txId = await this.debitWallet(w);
    } catch (err) {
      this.logger.error(`Wallet debit failed for withdrawal ${w.id}: ${err}`);
      await this.withdrawals.update(
        { id: w.id },
        {
          status: WithdrawalStatus.FAILED,
          failedAt: new Date(),
          failureReason: 'Wallet debit failed',
        },
      );
      throw err;
    }

    await this.withdrawals.update(
      { id: w.id },
      { status: WithdrawalStatus.PENDING, transactionId: txId },
    );

    // 4. Call CinetPay (best effort; if it fails immediately, we refund)
    try {
      await this.callCinetPay(w);
      await this.withdrawals.update({ id: w.id }, { status: WithdrawalStatus.PROCESSING });
      await this.txs.update({ id: txId }, { status: TransactionStatus.PROCESSING });
    } catch (err: any) {
      this.logger.error(
        `CinetPay transfer failed for withdrawal ${w.id}, refunding wallet: ${err?.message ?? err}`,
      );
      await this.refundWallet(w, txId, 'CinetPay refused transfer');
      throw new BadRequestException('Le retrait a échoué. Solde restitué.');
    }

    return { status: WithdrawalStatus.PROCESSING, transactionId: txId };
  }

  /**
   * Get a withdrawal status — used by mobile to poll.
   */
  async getStatus(userId: string, withdrawalId: string): Promise<{
    id: string;
    status: WithdrawalStatus;
    amount: number;
    fee: number;
    channel: WithdrawalChannel;
    recipientPhone: string;
    completedAt: Date | null;
    failureReason: string | null;
  }> {
    const w = await this.withdrawals.findOne({ where: { id: withdrawalId, userId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    return {
      id: w.id,
      status: w.status,
      amount: w.amount,
      fee: w.fee,
      channel: w.channel,
      recipientPhone: w.recipientPhone,
      completedAt: w.completedAt ?? null,
      failureReason: w.failureReason ?? null,
    };
  }

  /**
   * Cancel a PENDING_PIN withdrawal (user changed mind).
   * No-op if already debited.
   */
  async cancel(userId: string, withdrawalId: string): Promise<void> {
    const w = await this.withdrawals.findOne({ where: { id: withdrawalId, userId } });
    if (!w) throw new NotFoundException('Withdrawal not found');
    if (w.status !== WithdrawalStatus.PENDING_PIN) {
      throw new BadRequestException('Cannot cancel a withdrawal in this state');
    }
    await this.withdrawals.update({ id: w.id }, { status: WithdrawalStatus.EXPIRED });
  }

  /**
   * Called by webhook handler when CinetPay confirms or rejects the transfer.
   */
  async handleCinetPayCallback(
    cinetpayTxId: string,
    finalStatus: 'SUCCESS' | 'FAILED',
    reason?: string,
  ): Promise<void> {
    const w = await this.withdrawals.findOne({ where: { cinetpayTransactionId: cinetpayTxId } });
    if (!w) {
      this.logger.warn(`Webhook for unknown CinetPay tx ${cinetpayTxId}`);
      return;
    }
    if (w.status !== WithdrawalStatus.PROCESSING) {
      this.logger.warn(`Webhook for withdrawal ${w.id} in non-PROCESSING state ${w.status}`);
      return;
    }

    if (finalStatus === 'SUCCESS') {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Withdrawal).update(
          { id: w.id },
          { status: WithdrawalStatus.COMPLETED, completedAt: new Date() },
        );
        if (w.transactionId) {
          await manager.getRepository(Transaction).update(
            { id: w.transactionId },
            { status: TransactionStatus.COMPLETED, completedAt: new Date() },
          );
        }
      });
      this.logger.log(`Withdrawal completed: id=${w.id}`);
    } else {
      // CinetPay rejected after accepting initially → refund
      await this.refundWallet(w, w.transactionId!, reason ?? 'Transfer failed at provider');
      this.logger.log(`Withdrawal refunded: id=${w.id} reason=${reason}`);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private enforceKycLimits(tier: KycTier, amount: number) {
    const max = this.maxPerWithdrawalForTier(tier);
    if (amount > max) {
      throw new ForbiddenException(
        `Withdrawal limit for ${tier}: max ${max} XAF per transaction. Upgrade your KYC.`,
      );
    }
  }

  private maxPerWithdrawalForTier(tier: KycTier): number {
    const cfg = {
      [KycTier.TIER_0]: 25000,
      [KycTier.TIER_1]: 200000,
      [KycTier.TIER_2]: 1000000,
    };
    return cfg[tier];
  }

  private dailyLimitForTier(tier: KycTier): number {
    return (
      this.config.get<number>(`wallet.dailyTxLimit.${tier.toLowerCase().replace('_', '')}`) ??
      ({
        [KycTier.TIER_0]: 50000,
        [KycTier.TIER_1]: 300000,
        [KycTier.TIER_2]: 1500000,
      }[tier])
    );
  }

  private computeFee(amount: number): number {
    if (amount <= 10000) return 0;
    return Math.min(Math.ceil(amount * 0.01), 500);
  }

  private async computeDailyWithdrawn(userId: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.withdrawals
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amount), 0)', 'sum')
      .where('w.user_id = :userId', { userId })
      .andWhere('w.status IN (:...statuses)', {
        statuses: [WithdrawalStatus.COMPLETED, WithdrawalStatus.PROCESSING, WithdrawalStatus.PENDING],
      })
      .andWhere('w.created_at >= :since', { since })
      .getRawOne<{ sum: string }>();
    return parseInt(result?.sum ?? '0', 10);
  }

  /**
   * Debit the wallet inside a DB transaction with row-level lock.
   * Posts ledger entries: USER_WALLET DEBIT (amount + fee), EXTERNAL CREDIT (amount), KELYO_FEES CREDIT (fee).
   */
  private async debitWallet(w: Withdrawal): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const externalAccount =
        w.channel === WithdrawalChannel.AIRTEL_MONEY
          ? LedgerAccount.EXTERNAL_AIRTEL
          : LedgerAccount.EXTERNAL_MOOV;
      const channelMap: Record<WithdrawalChannel, PaymentChannel> = {
        [WithdrawalChannel.AIRTEL_MONEY]: PaymentChannel.AIRTEL_MONEY,
        [WithdrawalChannel.MOOV_MONEY]: PaymentChannel.MOOV_MONEY,
      };

      const tx = await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          walletId: w.walletId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PROCESSING,
          amount: w.amount,
          fee: w.fee,
          currency: 'XAF',
          channel: channelMap[w.channel],
          counterpartyPhone: w.recipientPhone,
          counterpartyName: w.recipientName ?? null,
          description: `Retrait vers ${w.channel}`,
        }),
      );

      const lines = [
        {
          account: LedgerAccount.USER_WALLET,
          direction: LedgerDirection.DEBIT,
          walletId: w.walletId,
          amount: w.amount + w.fee,
          memo: `Withdrawal to ${w.recipientPhone}`,
        },
        {
          account: externalAccount,
          direction: LedgerDirection.CREDIT,
          amount: w.amount,
          memo: `Outbound to ${w.channel}`,
        },
      ];
      if (w.fee > 0) {
        lines.push({
          account: LedgerAccount.KELYO_FEES,
          direction: LedgerDirection.CREDIT,
          amount: w.fee,
          memo: 'Withdrawal fee',
        } as any);
      }

      await this.ledger.post(manager, tx.id, lines);
      return tx.id;
    });
  }

  /**
   * Refund the wallet if CinetPay refused. Posts the inverse ledger entries.
   */
  private async refundWallet(
    w: Withdrawal,
    transactionId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const externalAccount =
        w.channel === WithdrawalChannel.AIRTEL_MONEY
          ? LedgerAccount.EXTERNAL_AIRTEL
          : LedgerAccount.EXTERNAL_MOOV;

      const reversalTx = await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          walletId: w.walletId,
          type: TransactionType.REVERSAL,
          status: TransactionStatus.COMPLETED,
          amount: w.amount + w.fee,
          fee: 0,
          currency: 'XAF',
          description: `Remboursement retrait raté: ${reason}`,
          metadata: { originalTransactionId: transactionId, withdrawalId: w.id },
          completedAt: new Date(),
        }),
      );

      const lines = [
        {
          account: externalAccount,
          direction: LedgerDirection.DEBIT,
          amount: w.amount,
          memo: `Reversal: ${reason}`,
        },
        {
          account: LedgerAccount.USER_WALLET,
          direction: LedgerDirection.CREDIT,
          walletId: w.walletId,
          amount: w.amount + w.fee,
          memo: `Refund withdrawal ${w.id}`,
        },
      ];
      if (w.fee > 0) {
        lines.push({
          account: LedgerAccount.KELYO_FEES,
          direction: LedgerDirection.DEBIT,
          amount: w.fee,
          memo: 'Fee refund',
        } as any);
      }

      await this.ledger.post(manager, reversalTx.id, lines);

      await manager.getRepository(Withdrawal).update(
        { id: w.id },
        {
          status: WithdrawalStatus.FAILED,
          failedAt: new Date(),
          failureReason: reason,
        },
      );
      await manager.getRepository(Transaction).update(
        { id: transactionId },
        {
          status: TransactionStatus.FAILED,
          failedAt: new Date(),
          failureReason: reason,
        },
      );
    });
  }

  /**
   * Call CinetPay's transfer API. Throws on immediate refusal.
   */
  private async callCinetPay(w: Withdrawal): Promise<void> {
    const phoneClean = w.recipientPhone.replace('+', '');
    const prefix = phoneClean.slice(0, 3);
    const localNumber = phoneClean.slice(3);

    const paymentMethodMap: Record<WithdrawalChannel, 'AIRTEL' | 'MOOV'> = {
      [WithdrawalChannel.AIRTEL_MONEY]: 'AIRTEL',
      [WithdrawalChannel.MOOV_MONEY]: 'MOOV',
    };

    try {
      const result = await this.cinetpay.initiateTransfer({
        prefix,
        phone: localNumber,
        amount: w.amount,
        client_transaction_id: w.id,
        payment_method: paymentMethodMap[w.channel],
        name: w.recipientName?.split(' ')[0] ?? 'Client',
        surname: w.recipientName?.split(' ').slice(1).join(' ') ?? 'Kelyo',
      });

      // Persist CinetPay's transaction id for webhook matching
      const cpTxId = (result?.data?.[0]?.transaction_id as string | undefined) ?? w.id;
      await this.withdrawals.update({ id: w.id }, { cinetpayTransactionId: cpTxId });
    } catch (err: any) {
      throw new Error(`CinetPay refused: ${err?.message ?? 'unknown'}`);
    }
  }
}
