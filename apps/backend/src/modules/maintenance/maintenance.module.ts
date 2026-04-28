import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MaintenanceService } from "./maintenance.service";
import { IdempotencyKey } from "../../common/entities/idempotency-key.entity";
import { Wallet } from "../wallet/entities/wallet.entity";
import { OtpCode } from "../auth/entities/otp-code.entity";
import { OtpService } from "../auth/otp.service";
import { ConsoleSmsProvider } from "../auth/sms/console-sms.provider";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyKey, Wallet, OtpCode]),
    WalletModule,
  ],
  providers: [MaintenanceService, OtpService, ConsoleSmsProvider],
})
export class MaintenanceModule {}
