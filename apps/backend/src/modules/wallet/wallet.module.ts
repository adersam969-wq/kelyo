import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Transaction } from './entities/transaction.entity';
import { IdempotencyKey } from '../../common/entities/idempotency-key.entity';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, LedgerEntry, Transaction, IdempotencyKey])],
  providers: [LedgerService, WalletService],
  controllers: [WalletController],
  exports: [LedgerService, WalletService, TypeOrmModule],
})
export class WalletModule {}
