import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import cinetpayConfig from './config/cinetpay.config';
import walletConfig from './config/wallet.config';
import { validateEnv } from './config/env.validation';

import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { CinetPayModule } from './modules/cinetpay/cinetpay.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, cinetpayConfig, walletConfig],
      validate: validateEnv,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      },
    ]),
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    WalletModule,
    AuthModule,
    KycModule,
    MaintenanceModule,
    CinetPayModule,
    PaymentsModule,
    WithdrawalsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
