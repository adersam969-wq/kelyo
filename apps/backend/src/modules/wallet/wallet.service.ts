import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet, WalletStatus } from './entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentChannel,
} from './entities/transaction.entity';
import { LedgerService } from './ledger.service';
import { LedgerAccount, LedgerDirection } from './entities/ledger-entry.entity';
import { assertValidAmount } from '../../common/utils/money';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  async getWalletForUser(userId: string): Promise<Wallet> {
    const wallet = await this.wallets.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async listTransactions(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: Transaction[]; total: number; page: number; pageSize: number }> {
    const wallet = await this.getWalletForUser(userId);
    const [items, total] = await this.transactions.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /**
   * Internal P2P transfer between two Kelyo wallets.
   * Atomic: ledger entries + balance updates happen in the same DB transaction.
   */
  async transferP2P(input: {
    fromUserId: string;
    toRecipient: string;
    amount: number;
    description?: string;
  }): Promise<{ transactionId: string; recipientName: string }> {
    assertValidAmount(input.amount);

    return this.dataSource.transaction(async (manager) => {
      const fromWallet = await manager
        .getRepository(Wallet)
        .findOne({ where: { userId: input.fromUserId } });
      if (!fromWallet) throw new NotFoundException('Sender wallet not found');

      // Resolve recipient from phone (+241...), Kelyo ID (KEL...), or @username
      const raw = input.toRecipient.trim();
      let lookupSql = "";
      let lookupValue = raw;
      if (raw.startsWith("+")) {
        lookupSql = "u.phone = $1";
      } else if (/^KEL\d{8}$/i.test(raw.replace(/[\s-]/g, ""))) {
        lookupValue = raw.toUpperCase().replace(/[\s-]/g, "");
        lookupSql = "u.kelyo_id = $1";
      } else if (raw.startsWith("@")) {
        lookupValue = raw.slice(1).toLowerCase();
        lookupSql = "u.username = $1";
      } else {
        throw new BadRequestException("Recipient must be phone (+241...), Kelyo ID (KEL...) or @username");
      }
      const recipient = await manager.query(
        `SELECT w.id AS wallet_id, u.id AS user_id, u.phone, u.first_name, u.last_name, u.kelyo_id, u.username
         FROM users u JOIN wallets w ON w.user_id = u.id
         WHERE ${lookupSql} AND u.is_active = true`,
        [lookupValue],
      );
      if (!recipient.length) {
        throw new NotFoundException('Recipient not found on Kelyo');
      }
      const recipientRow = recipient[0];
      if (recipientRow.user_id === input.fromUserId) {
        throw new BadRequestException('Cannot transfer to yourself');
      }

      // Create the OUT transaction record
      const txOut = await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          walletId: fromWallet.id,
          type: TransactionType.TRANSFER_OUT,
          status: TransactionStatus.PROCESSING,
          amount: input.amount,
          fee: 0,
          currency: 'XAF',
          channel: PaymentChannel.KELYO_WALLET,
          counterpartyName:
            [recipientRow.first_name, recipientRow.last_name].filter(Boolean).join(' ') || null,
          counterpartyPhone: recipientRow.phone,
          counterpartyWalletId: recipientRow.wallet_id,
          description: input.description ?? null,
        }),
      );

      // Create the IN transaction record
      const txIn = await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          walletId: recipientRow.wallet_id,
          type: TransactionType.TRANSFER_IN,
          status: TransactionStatus.PROCESSING,
          amount: input.amount,
          fee: 0,
          currency: 'XAF',
          channel: PaymentChannel.KELYO_WALLET,
          counterpartyWalletId: fromWallet.id,
          description: input.description ?? null,
        }),
      );

      // Post the ledger: balanced — debit sender, credit recipient
      await this.ledger.post(manager, txOut.id, [
        {
          account: LedgerAccount.USER_WALLET,
          direction: LedgerDirection.DEBIT,
          walletId: fromWallet.id,
          amount: input.amount,
          memo: `Transfer to ${recipientRow.phone}`,
        },
        {
          account: LedgerAccount.USER_WALLET,
          direction: LedgerDirection.CREDIT,
          walletId: recipientRow.wallet_id,
          amount: input.amount,
          memo: `Transfer from wallet ${fromWallet.id}`,
        },
      ]);

      const now = new Date();
      await manager
        .getRepository(Transaction)
        .update({ id: txOut.id }, { status: TransactionStatus.COMPLETED, completedAt: now });
      await manager
        .getRepository(Transaction)
        .update({ id: txIn.id }, { status: TransactionStatus.COMPLETED, completedAt: now });

      const recipientName = [recipientRow.first_name, recipientRow.last_name].filter(Boolean).join(' ') || recipientRow.username || recipientRow.kelyo_id || recipientRow.phone;
      return { transactionId: txOut.id, recipientName };
    });
  }
}
