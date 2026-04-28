import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, IsNull, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { OtpCode, OtpPurpose } from './entities/otp-code.entity';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import type { SmsProvider } from './sms/console-sms.provider';

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
    @Inject(ConsoleSmsProvider) private readonly sms: SmsProvider,
  ) {}

  /**
   * Request an OTP. Rate-limited per phone.
   * Always returns successfully even if rate-limited from caller's perspective —
   * but at most 3 SMS will be sent in 15 min per phone.
   */
  async request(phone: string, purpose: OtpPurpose): Promise<{ expiresInSeconds: number }> {
    const since = new Date(Date.now() - REQUEST_WINDOW_MS);
    const recent = await this.otps.count({
      where: { phone, purpose, createdAt: MoreThan(since) },
    });
    if (recent >= MAX_REQUESTS_PER_WINDOW) {
      throw new TooManyRequestsException('Too many OTP requests. Please wait a few minutes.');
    }

    // Invalidate any previous active OTPs for this (phone, purpose)
    await this.otps.update(
      { phone, purpose, usedAt: IsNull(), invalidatedAt: IsNull() },
      { invalidatedAt: new Date() },
    );

    const code = this.generateCode();
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await this.otps.save(this.otps.create({ phone, purpose, codeHash, expiresAt }));
    await this.sms.send(phone, `Votre code Kelyo : ${code}. Valide ${OTP_TTL_SECONDS / 60} min.`);

    return { expiresInSeconds: OTP_TTL_SECONDS };
  }

  /**
   * Verify an OTP code. Consumes it on success.
   * Tracks attempts; invalidates after MAX_ATTEMPTS.
   */
  async verify(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.otps
      .createQueryBuilder('o')
      .addSelect('o.codeHash')
      .where('o.phone = :phone', { phone })
      .andWhere('o.purpose = :purpose', { purpose })
      .andWhere('o.usedAt IS NULL')
      .andWhere('o.invalidatedAt IS NULL')
      .andWhere('o.expiresAt > :now', { now: new Date() })
      .orderBy('o.createdAt', 'DESC')
      .getOne();

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await this.otps.update({ id: otp.id }, { invalidatedAt: new Date() });
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    const ok = await argon2.verify(otp.codeHash, code);
    if (!ok) {
      await this.otps.update({ id: otp.id }, { attempts: otp.attempts + 1 });
      throw new UnauthorizedException('Invalid code');
    }

    await this.otps.update({ id: otp.id }, { usedAt: new Date() });
  }

  /** Periodic cleanup of expired OTPs */
  async cleanup(): Promise<number> {
    const result = await this.otps.delete({
      expiresAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    });
    return result.affected ?? 0;
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < OTP_LENGTH; i++) code += randomInt(0, 10).toString();
    return code;
  }
}
