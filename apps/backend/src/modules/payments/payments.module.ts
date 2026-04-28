import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaymentLink } from './entities/payment-link.entity';
import { QrCode } from './entities/qr-code.entity';
import { Transaction } from '../wallet/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { User } from '../users/entities/user.entity';
import { IdempotencyKey } from '../../common/entities/idempotency-key.entity';

import { TopupService } from './topup.service';
import { PaymentsWebhooksService } from './webhooks.service';
import { QrCodesService } from './qr-codes.service';
import { PaymentLinksService } from './payment-links.service';
import { PayService } from './pay.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';

import { CinetPayModule } from '../cinetpay/cinetpay.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEvent,
      PaymentLink,
      QrCode,
      Transaction,
      Wallet,
      User,
      IdempotencyKey,
    ]),
    CinetPayModule,
    WalletModule, // for LedgerService
  ],
  providers: [
    TopupService,
    PaymentsWebhooksService,
    QrCodesService,
    PaymentLinksService,
    PayService,
  ],
  controllers: [PaymentsController, WebhooksController],
  exports: [TopupService, PaymentsWebhooksService, QrCodesService, PaymentLinksService, PayService],
})
export class PaymentsModule {}
