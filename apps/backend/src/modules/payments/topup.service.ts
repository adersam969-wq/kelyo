import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentChannel,
} from '../wallet/entities/transaction.entity';
import { Wallet, WalletStatus } from '../wallet/entities/wallet.entity';
import { User } from '../users/entities/user.entity';
import { CinetPayClient } from '../cinetpay/cinetpay.client';
import { assertValidAmount } from '../../common/utils/money';

/**
 * Top-up flow:
 *  1. User picks an amount and a channel (Mobile Money / Card)
 *  2. We create a PENDING Transaction (no balance change yet)
 *  3. We call CinetPay /v2/payment with our internal transaction id
 *  4. We return the checkout URL to the client
 *  5. The user completes payment on CinetPay-hosted UI
 *  6. CinetPay calls our webhook → that's where we credit the wallet (see WebhooksService)
 *
 * No balance is ever changed here. The PaymentsWebhooksService is the only thing
 * that can credit a wallet from a top-up.
 */
@Injectable()
export class TopupService {
  private readonly logger = new Logger(TopupService.name);

  constructor(
    @InjectRepository(Transaction) private readonly txs: Repository<Transaction>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly cinetpay: CinetPayClient,
  ) {}

  async initiateTopup(input: {
    userId: string;
    amount: number;
    channel: PaymentChannel;
    description?: string;
  }): Promise<{ transactionId: string; checkoutUrl: string }> {
    assertValidAmount(input.amount);

    if (input.channel === PaymentChannel.KELYO_WALLET) {
      throw new BadRequestException('Cannot top-up from Kelyo wallet');
    }
    if (input.amount % 5 !== 0) {
      throw new BadRequestException('Amount must be a multiple of 5 XAF');
    }

    // Pre-flight: tier-based daily limits should be checked here too — Phase 2.5
    const wallet = await this.wallets.findOne({ where: { userId: input.userId } });
    if (!wallet || wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet not active');
    }

    const user = await this.users.findOne({ where: { id: input.userId } });
    if (!user) throw new BadRequestException('User not found');

    // Create the PENDING transaction
    const tx = await this.txs.save(
      this.txs.create({
        walletId: wallet.id,
        type: TransactionType.TOPUP,
        status: TransactionStatus.PENDING,
        amount: input.amount,
        fee: 0,
        currency: 'XAF',
        channel: input.channel,
        description: input.description ?? 'Recharge wallet Kelyo',
      }),
    );

    // Call CinetPay
    const channelMap: Record<PaymentChannel, 'MOBILE_MONEY' | 'CREDIT_CARD' | 'ALL'> = {
      [PaymentChannel.AIRTEL_MONEY]: 'MOBILE_MONEY',
      [PaymentChannel.MOOV_MONEY]: 'MOBILE_MONEY',
      [PaymentChannel.CARD_VISA]: 'CREDIT_CARD',
      [PaymentChannel.CARD_MASTERCARD]: 'CREDIT_CARD',
      [PaymentChannel.KELYO_WALLET]: 'ALL', // unreachable
    };

    const cpRes = await this.cinetpay.initializePayment({
      transaction_id: tx.id,
      amount: input.amount,
      currency: 'XAF',
      description: input.description ?? 'Recharge wallet Kelyo',
      channels: channelMap[input.channel],
      customer_phone_number: user.phone,
      customer_country: user.countryCode,
      lang: 'fr',
      metadata: JSON.stringify({ userId: input.userId, kind: 'TOPUP' }),
    });

    // Store the CinetPay token as external_ref on our tx for later lookup
    await this.txs.update(
      { id: tx.id },
      {
        status: TransactionStatus.PROCESSING,
        externalRef: cpRes.data.payment_token,
        metadata: { cinetpayToken: cpRes.data.payment_token },
      },
    );

    this.logger.log(`Top-up initiated: tx=${tx.id} amount=${input.amount} channel=${input.channel}`);

    return {
      transactionId: tx.id,
      checkoutUrl: cpRes.data.payment_url,
    };
  }

  async getTopupStatus(userId: string, transactionId: string): Promise<{
    transactionId: string;
    status: TransactionStatus;
    amount: number;
    completedAt: Date | null;
  }> {
    const tx = await this.txs
      .createQueryBuilder('t')
      .innerJoin('wallets', 'w', 'w.id = t.wallet_id')
      .where('t.id = :id', { id: transactionId })
      .andWhere('w.user_id = :userId', { userId })
      .andWhere('t.type = :type', { type: TransactionType.TOPUP })
      .getOne();

    if (!tx) throw new BadRequestException('Transaction not found');
    return {
      transactionId: tx.id,
      status: tx.status,
      amount: tx.amount,
      completedAt: tx.completedAt ?? null,
    };
  }
}
