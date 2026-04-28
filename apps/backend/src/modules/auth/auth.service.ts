import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { TokenService, TokenPair } from './token.service';
import { OtpPurpose } from './entities/otp-code.entity';
import { UsersService } from '../users/users.service';
import { normalizePhone } from '../../common/utils/phone';

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {}

  /**
   * Step 1 of signup or login — request an OTP.
   */
  async requestOtp(rawPhone: string, purpose: OtpPurpose, countryCode = 'GA') {
    const phone = normalizePhone(rawPhone, countryCode);
    return this.otp.request(phone, purpose);
  }

  /**
   * Step 2 — verify the code and either:
   *  - SIGNUP: create the user + wallet, issue tokens
   *  - LOGIN:  return tokens for an existing user
   */
  async verifyOtpAndAuthenticate(
    rawPhone: string,
    code: string,
    purpose: OtpPurpose,
    countryCode = 'GA',
    ctx?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair & { isNewUser: boolean }> {
    const phone = normalizePhone(rawPhone, countryCode);
    await this.otp.verify(phone, purpose, code);

    let user = await this.users.findByPhone(phone);
    let isNewUser = false;

    if (!user) {
      if (purpose !== OtpPurpose.SIGNUP) {
        throw new UnauthorizedException('Account not found. Please sign up.');
      }
      user = await this.users.createWithWallet({ phone, countryCode });
      isNewUser = true;
    } else {
      if (!user.isActive) throw new UnauthorizedException('Account disabled');
      await this.users.updateLastLogin(user.id);
    }

    const pair = await this.tokens.issuePair(user, ctx);
    return { ...pair, isNewUser };
  }

  async refresh(refreshToken: string, ctx?: { userAgent?: string; ip?: string }) {
    return this.tokens.refresh(refreshToken, ctx);
  }

  async logout(userId: string) {
    await this.tokens.revokeAllForUser(userId);
  }
}
