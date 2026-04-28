import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { OtpCode } from './entities/otp-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpCode, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: cfg.get<string>('jwt.accessExpiresIn') },
      }),
    }),
    UsersModule,
  ],
  providers: [OtpService, TokenService, AuthService, JwtStrategy, ConsoleSmsProvider],
  controllers: [AuthController],
  exports: [AuthService, TokenService, JwtStrategy, PassportModule],
})
export class AuthModule {}
