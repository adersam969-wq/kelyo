import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  WebhookEvent,
  WebhookEventType,
  WebhookProcessingStatus,
  WebhookSource,
} from './entities/webhook-event.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentChannel,
} from '../wallet/entities/transaction.entity';
import { LedgerService } from '../wallet/ledger.service';
import {
  LedgerAccount,
  LedgerDirection,
} from '../wallet/entities/ledger-entry.entity';
import { CinetPayClient } from '../cinetpay/cinetpay.client';
import { CinetPayWebhookPayload } from '../cinetpay/types';

/**
 * Webhooks service — the only place that credits user wallets from external sources.
 *
 * Security model (defense in depth):
 *  1. Verify HMAC signature from CinetPay before any state change
 *  2. Idempotency — if we've seen this `cpm_trans_id` before, skip
 *  3. Independent verification — call CinetPay's check API to confirm status,
 *     do NOT trust the webhook body alone
 *  4. All wallet credits happen inside a DB transaction with SELECT FOR UPDATE
 *  5. Append-only log of every webhook (signature OK or not) for audit
 */
@Injectable()
export class PaymentsWebhooksService {
  private readonly logger = new Logger(PaymentsWebhooksService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly events: Repository<WebhookEvent>,
    @InjectRepository(Transaction)
    private readonly txs: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly cinetpay: CinetPayClient,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Process a CinetPay payment webhook.
   *
   * Always returns 200 to CinetPay even on internal errors — they retry on non-2xx,
   * which would amplify problems. Errors are logged for ops to handle.
   *
   * Returns whether processing was successful (for ops monitoring; not for CinetPay).
   */
  async handlePaymentWebhook(
    payload: CinetPayWebhookPayload,
    providedToken: string | undefined,
  ): Promise<{ ok: boolean; reason?: string }> {
    const cpmTransId = payload.cpm_trans_id;
    if (!cpmTransId) {
      return { ok: false, reason: 'Missing cpm_trans_id' };
    }

    // 1. Log the event first (append-only audit)
    const sigValid = providedToken
      ? this.cinetpay.verifyWebhookSignature(payload as Record<string, unknown>, providedToken)
      : false;

    let eventId: string;
    try {
      const evt = await this.events.save(
        this.events.create({
          source: WebhookSource.CINETPAY,
          eventType: WebhookEventType.PAYMENT_NOTIFICATION,
          externalEventId: cpmTransId,
          signatureProvided: providedToken ?? null,
          signatureValid: sigValid,
          payload: payload as Record<string, unknown>,
          processingStatus: WebhookProcessingStatus.RECEIVED,
        }),
      );
      eventId = evt.id;
    } catch (err: any) {
      // Unique constraint on (source, external_event_id) → duplicate
      if (err?.code === '23505') {
        this.logger.warn(`Duplicate webhook for cpm_trans_id=${cpmTransId} — ignoring`);
        return { ok: true, reason: 'duplicate' };
      }
      throw err;
    }

    // 2. Reject if signature invalid
    if (!sigValid) {
      this.logger.error(`Webhook signature invalid: cpm_trans_id=${cpmTransId}`);
      await this.events.update(
        { id: eventId },
        {
          processingStatus: WebhookProcessingStatus.REJECTED_SIGNATURE,
          processedAt: new Date(),
          errorMessage: 'HMAC signature mismatch',
        },
      );
      return { ok: false, reason: 'invalid_signature' };
    }

    // 3. Independent verification via CinetPay API
    let independentStatus: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELED' | undefined;
    let independentAmount = 0;
    try {
      const check = await this.cinetpay.checkPayment(cpmTransId);
      independentStatus = check.data.status;
      independentAmount = parseInt(check.data.amount, 10);
    } catch (err) {
      this.logger.error(`Could not verify webhook independently: ${err}`);
      await this.events.update(
        { id: eventId },
        {
          processingStatus: WebhookProcessingStatus.ERROR,
          processedAt: new Date(),
          errorMessage: 'Independent verification failed',
        },
      );
      return { ok: false, reason: 'verification_failed' };
    }

    // 4. Find our matching transaction (cpm_trans_id is our transaction.id)
    const tx = await this.txs.findOne({ where: { id: cpmTransId } });
    if (!tx) {
      this.logger.error(`Webhook for unknown transaction: ${cpmTransId}`);
      await this.events.update(
        { id: eventId },
        {
          processingStatus: WebhookProcessingStatus.ERROR,
          processedAt: new Date(),
          errorMessage: 'Transaction not found',
        },
      );
      return { ok: false, reason: 'unknown_transaction' };
    }

    // Already processed?
    if (
      tx.status === TransactionStatus.COMPLETED ||
      tx.status === TransactionStatus.FAILED ||
      tx.status === TransactionStatus.REVERSED
    ) {
      this.logger.warn(`Transaction ${tx.id} already finalized (${tx.status}) — skipping`);
      await this.events.update(
        { id: eventId },
        {
          processingStatus: WebhookProcessingStatus.REJECTED_DUPLICATE,
          processedAt: new Date(),
        },
      );
      return { ok: true, reason: 'already_finalized' };
    }

    // Amount sanity: independent amount must match our transaction
    if (independentAmount !== tx.amount) {
      this.logger.error(
        `Amount mismatch: tx=${tx.id} expected=${tx.amount} from CinetPay=${independentAmount}`,
      );
      await this.events.update(
        { id: eventId },
        {
          processingStatus: WebhookProcessingStatus.ERROR,
          processedAt: new Date(),
          errorMessage: `Amount mismatch ${tx.amount} vs ${independentAmount}`,
        },
      );
      return { ok: false, reason: 'amount_mismatch' };
    }

    // 5. Process based on CinetPay's authoritative status
    if (independentStatus === 'ACCEPTED') {
      await this.creditWallet(tx, eventId, payload);
    } else if (independentStatus === 'REFUSED' || independentStatus === 'CANCELED') {
      await this.markFailed(tx, eventId, independentStatus);
    } else {
      this.logger.log(`Tx ${tx.id} still pending/unknown (status=${independentStatus})`);
      await this.events.update(
        { id: eventId },
        { processingStatus: WebhookProcessingStatus.PROCESSED, processedAt: new Date() },
      );
    }

    return { ok: true };
  }

  /**
   * Credit a wallet from a successful top-up.
   * Uses LedgerService inside a DB transaction → atomic, locks wallet, posts balanced ledger.
   */
  private async creditWallet(
    tx: Transaction,
    eventId: string,
    _payload: CinetPayWebhookPayload,
  ) {
    if (tx.type !== TransactionType.TOPUP) {
      throw new Error(`Unexpected transaction type for credit: ${tx.type}`);
    }

    const externalAccount = this.channelToLedgerAccount(tx.channel ?? null);

    await this.dataSource.transaction(async (manager) => {
      // Re-read the transaction inside the lock to handle concurrent webhook deliveries
      const fresh = await manager
        .getRepository(Transaction)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id: tx.id })
        .getOne();
      if (!fresh) throw new Error('Transaction vanished');
      if (fresh.status === TransactionStatus.COMPLETED) {
        // Concurrent webhook beat us to it — fine
        return;
      }

      await this.ledger.post(manager, fresh.id, [
        {
          account: externalAccount,
          direction: LedgerDirection.DEBIT,
          amount: fresh.amount,
          memo: `Top-up via ${fresh.channel}`,
        },
        {
          account: LedgerAccount.USER_WALLET,
          direction: LedgerDirection.CREDIT,
          walletId: fresh.walletId,
          amount: fresh.amount,
          memo: `Top-up tx ${fresh.id}`,
        },
      ]);

      await manager.getRepository(Transaction).update(
        { id: fresh.id },
        { status: TransactionStatus.COMPLETED, completedAt: new Date() },
      );
    });

    await this.events.update(
      { id: eventId },
      { processingStatus: WebhookProcessingStatus.PROCESSED, processedAt: new Date() },
    );

    this.logger.log(`Top-up credited: tx=${tx.id} amount=${tx.amount}`);
  }

  private async markFailed(
    tx: Transaction,
    eventId: string,
    reason: string,
  ) {
    await this.txs.update(
      { id: tx.id },
      {
        status: TransactionStatus.FAILED,
        failedAt: new Date(),
        failureReason: reason,
      },
    );
    await this.events.update(
      { id: eventId },
      { processingStatus: WebhookProcessingStatus.PROCESSED, processedAt: new Date() },
    );
    this.logger.log(`Top-up failed: tx=${tx.id} reason=${reason}`);
  }

  private channelToLedgerAccount(channel: PaymentChannel | null): LedgerAccount {
    switch (channel) {
      case PaymentChannel.AIRTEL_MONEY:
        return LedgerAccount.EXTERNAL_AIRTEL;
      case PaymentChannel.MOOV_MONEY:
        return LedgerAccount.EXTERNAL_MOOV;
      case PaymentChannel.CARD_VISA:
      case PaymentChannel.CARD_MASTERCARD:
        return LedgerAccount.EXTERNAL_CARD;
      default:
        return LedgerAccount.CINETPAY_CLEARING;
    }
  }
}
