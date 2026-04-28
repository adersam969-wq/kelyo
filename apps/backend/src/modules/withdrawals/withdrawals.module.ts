import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Withdrawal } from './entities/withdrawal.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../wallet/entities/transaction.entity';
import { IdempotencyKey } from '../../common/entities/idempotency-key.entity';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { PinService } from '../users/pin.service';
import { CinetPayModule } from '../cinetpay/cinetpay.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal, User, Wallet, Transaction, IdempotencyKey]),
    CinetPayModule,
    WalletModule,
  ],
  providers: [WithdrawalsService, PinService],
  controllers: [WithdrawalsController],
  exports: [WithdrawalsService, PinService],
})
export class WithdrawalsModule {}
