import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentChannel,
} from '../wallet/entities/transaction.entity';
import { Wallet, WalletStatus } from '../wallet/entities/wallet.entity';
import { LedgerService } from '../wallet/ledger.service';
import { LedgerAccount, LedgerDirection } from '../wallet/entities/ledger-entry.entity';
import { QrCode, QrCodeStatus, QrCodeType } from './entities/qr-code.entity';
import { PaymentLink, PaymentLinkStatus } from './entities/payment-link.entity';
import { assertValidAmount } from '../../common/utils/money';
import { User } from '../users/entities/user.entity';

/**
 * Atomic payment from a user's wallet to a merchant's wallet, triggered by:
 *  - scanning a QR code, or
 *  - paying a payment link slug.
 *
 * The flow is identical to a P2P transfer at the ledger level — what changes
 * is what we record on the transactions (PAYMENT vs COLLECTION instead of TRANSFER_*)
 * and we update the QR/PaymentLink entity to mark it consumed.
 */
@Injectable()
export class PayService {
  private readonly logger = new Logger(PayService.name);

  constructor(private readonly dataSource: DataSource, private readonly ledger: LedgerService) {}

  /**
   * Pay by scanning a QR code. For STATIC QR (no amount), the payer specifies it.
   * For DYNAMIC QR, the amount on the QR is enforced.
   */
  async payByQr(input: {
    payerUserId: string;
    qrPayload: string;
    amountIfStatic?: number;
    description?: string;
  }): Promise<{ transactionId: string; amount: number; merchantName: string }> {
    return this.dataSource.transaction(async (manager) => {
      const qr = await manager
        .getRepository(QrCode)
        .createQueryBuilder('q')
        .setLock('pessimistic_write')
        .where('q.payload = :payload', { payload: input.qrPayload })
        .getOne();

      if (!qr) throw new NotFoundException('QR code not found');
      if (qr.status !== QrCodeStatus.ACTIVE) {
        throw new BadRequestException(`QR is ${qr.status}`);
      }
      if (qr.expiresAt && qr.expiresAt < new Date()) {
        throw new BadRequestException('QR expired');
      }

      let amount: number;
      if (qr.type === QrCodeType.DYNAMIC) {
        amount = qr.amount!;
      } else {
        if (!input.amountIfStatic) {
          throw new BadRequestException('Static QR requires amountIfStatic');
        }
        assertValidAmount(input.amountIfStatic);
        amount = input.amountIfStatic;
      }

      const result = await this.settle(manager, {
        payerUserId: input.payerUserId,
        merchantId: qr.merchantId,
        amount,
        description: input.description ?? qr.description ?? 'Paiement QR',
      });

      // Mark dynamic QRs as USED (single-use); static QRs remain active
      if (qr.type === QrCodeType.DYNAMIC) {
        await manager.getRepository(QrCode).update({ id: qr.id }, { status: QrCodeStatus.USED });
      }

      return result;
    });
  }

  /**
   * Pay by payment link slug. Payment link is single-use.
   */
  async payByLink(input: {
    payerUserId: string;
    slug: string;
  }): Promise<{ transactionId: string; amount: number; merchantName: string }> {
    return this.dataSource.transaction(async (manager) => {
      const link = await manager
        .getRepository(PaymentLink)
        .createQueryBuilder('l')
        .setLock('pessimistic_write')
        .where('l.slug = :slug', { slug: input.slug })
        .getOne();

      if (!link) throw new NotFoundException('Payment link not found');
      if (link.status !== PaymentLinkStatus.ACTIVE) {
        throw new BadRequestException(`Link is ${link.status}`);
      }
      if (link.expiresAt && link.expiresAt < new Date()) {
        await manager
          .getRepository(PaymentLink)
          .update({ id: link.id }, { status: PaymentLinkStatus.EXPIRED });
        throw new BadRequestException('Link expired');
      }

      const result = await this.settle(manager, {
        payerUserId: input.payerUserId,
        merchantId: link.merchantId,
        amount: link.amount,
        description: link.description,
      });

      await manager.getRepository(PaymentLink).update(
        { id: link.id },
        {
          status: PaymentLinkStatus.PAID,
          paidAt: new Date(),
          paidByUserId: input.payerUserId,
          transactionId: result.transactionId,
        },
      );

      return result;
    });
  }

  /**
   * Shared settlement logic: locks both wallets, posts ledger, creates transaction pair.
   */
  private async settle(
    manager: any,
    input: {
      payerUserId: string;
      merchantId: string;
      amount: number;
      description: string;
    },
  ): Promise<{ transactionId: string; amount: number; merchantName: string }> {
    if (input.payerUserId === input.merchantId) {
      throw new BadRequestException('Cannot pay yourself');
    }

    const payerWallet: Wallet | null = await manager
      .getRepository(Wallet)
      .findOne({ where: { userId: input.payerUserId } });
    if (!payerWallet) throw new NotFoundException('Payer wallet not found');
    if (payerWallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Wallet not active');
    }
    if (payerWallet.availableBalance < input.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const merchantRow = await manager.query(
      `SELECT w.id AS wallet_id, u.first_name, u.last_name,
              COALESCE(mp.business_name,
                       CONCAT(u.first_name, ' ', u.last_name),
                       'Marchand') AS merchant_name
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       LEFT JOIN merchant_profiles mp ON mp.user_id = u.id
       WHERE u.id = $1 AND u.is_active = true`,
      [input.merchantId],
    );
    if (!merchantRow.length) throw new NotFoundException('Merchant not found');
    const merchant = merchantRow[0];

    const txOut = await manager.getRepository(Transaction).save(
      manager.getRepository(Transaction).create({
        walletId: payerWallet.id,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PROCESSING,
        amount: input.amount,
        fee: 0,
        currency: 'XAF',
        channel: PaymentChannel.KELYO_WALLET,
        counterpartyName: merchant.merchant_name,
        counterpartyWalletId: merchant.wallet_id,
        description: input.description,
      }),
    );

    const txIn = await manager.getRepository(Transaction).save(
      manager.getRepository(Transaction).create({
        walletId: merchant.wallet_id,
        type: TransactionType.COLLECTION,
        status: TransactionStatus.PROCESSING,
        amount: input.amount,
        fee: 0,
        currency: 'XAF',
        channel: PaymentChannel.KELYO_WALLET,
        counterpartyWalletId: payerWallet.id,
        description: input.description,
      }),
    );

    await this.ledger.post(manager, txOut.id, [
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.DEBIT,
        walletId: payerWallet.id,
        amount: input.amount,
        memo: `Payment to ${merchant.merchant_name}`,
      },
      {
        account: LedgerAccount.USER_WALLET,
        direction: LedgerDirection.CREDIT,
        walletId: merchant.wallet_id,
        amount: input.amount,
        memo: `Collection from wallet ${payerWallet.id}`,
      },
    ]);

    const now = new Date();
    await manager
      .getRepository(Transaction)
      .update({ id: txOut.id }, { status: TransactionStatus.COMPLETED, completedAt: now });
    await manager
      .getRepository(Transaction)
      .update({ id: txIn.id }, { status: TransactionStatus.COMPLETED, completedAt: now });

    this.logger.log(
      `Payment settled: payer=${input.payerUserId} merchant=${input.merchantId} amount=${input.amount}`,
    );
    return {
      transactionId: txOut.id,
      amount: input.amount,
      merchantName: merchant.merchant_name,
    };
  }
}
