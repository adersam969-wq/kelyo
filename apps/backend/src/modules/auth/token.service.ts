import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

interface AccessPayload {
  sub: string;
  phone: string;
  role: string;
  kycTier: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshes: Repository<RefreshToken>,
  ) {}

  /**
   * Issue a fresh token pair for a user.
   * Creates a new refresh-token family.
   */
  async issuePair(user: User, ctx?: { userAgent?: string; ip?: string }): Promise<TokenPair> {
    const familyId = randomUUID();
    return this.signAndStore(user, familyId, ctx);
  }

  /**
   * Refresh — rotates the token. Detects reuse and revokes the entire family.
   */
  async refresh(
    rawRefreshToken: string,
    ctx?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const existing = await this.refreshes.findOne({
      where: { tokenHash },
      relations: { /* none — we'll fetch user separately */ },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Reuse detection: if this token was already used, the entire family is compromised
    if (existing.usedAt || existing.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user=${existing.userId} family=${existing.familyId}. Revoking entire family.`,
      );
      await this.refreshes.update(
        { familyId: existing.familyId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Token reuse detected — all sessions revoked');
    }

    // Mark current as used
    await this.refreshes.update({ id: existing.id }, { usedAt: new Date() });

    // Load user
    const user = await this.refreshes.manager
      .getRepository(User)
      .findOne({ where: { id: existing.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User unavailable');
    }

    // Issue a new token in the same family
    const pair = await this.signAndStore(user, existing.familyId, ctx);

    // Link old → new
    const newTokenRow = await this.refreshes.findOne({
      where: { tokenHash: this.hashToken(pair.refreshToken) },
    });
    if (newTokenRow) {
      await this.refreshes.update({ id: existing.id }, { replacedById: newTokenRow.id });
    }

    return pair;
  }

  /**
   * Revoke all refresh tokens for a user (logout-everywhere).
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshes.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async signAndStore(
    user: User,
    familyId: string,
    ctx?: { userAgent?: string; ip?: string },
  ): Promise<TokenPair> {
    const payload: AccessPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      kycTier: user.kycTier,
    };
    const accessExpiresIn = this.parseDuration(
      this.config.get<string>('jwt.accessExpiresIn', '15m'),
    );
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshTtlSeconds = this.parseDuration(
      this.config.get<string>('jwt.refreshExpiresIn', '30d'),
    );
    const rawRefresh = randomBytes(48).toString('base64url');
    const refreshHash = this.hashToken(rawRefresh);

    await this.refreshes.save(
      this.refreshes.create({
        userId: user.id,
        familyId,
        tokenHash: refreshHash,
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
        userAgent: ctx?.userAgent ?? null,
        ipAddress: ctx?.ip ?? null,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefresh,
      accessExpiresIn,
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseDuration(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
  }
}
