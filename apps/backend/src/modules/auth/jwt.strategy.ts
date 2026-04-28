import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') ?? '',
    });
  }

  async validate(payload: {
    sub: string;
    phone: string;
    role: 'USER' | 'MERCHANT' | 'ADMIN';
    kycTier: 'TIER_0' | 'TIER_1' | 'TIER_2';
  }): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      kycTier: user.kycTier,
    };
  }
}
