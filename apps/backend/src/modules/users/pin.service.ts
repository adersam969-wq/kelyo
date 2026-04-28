import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './entities/user.entity';

const PIN_LENGTH = 4;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class PinService {
  private readonly logger = new Logger(PinService.name);

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /**
   * Set or change the PIN. The user must already be authenticated.
   * No old-PIN required for first-time setup; required when changing.
   */
  async setPin(userId: string, newPin: string, oldPin?: string): Promise<void> {
    if (!/^\d{4}$/.test(newPin)) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }
    if (this.isWeakPin(newPin)) {
      throw new BadRequestException('PIN too weak (avoid 0000, 1234, repeated digits)');
    }

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();

    if (user.pinHash) {
      if (!oldPin) throw new BadRequestException('Old PIN required to change');
      const ok = await argon2.verify(user.pinHash, oldPin);
      if (!ok) throw new UnauthorizedException('Old PIN incorrect');
    }

    const hash = await argon2.hash(newPin, { type: argon2.argon2id });
    await this.users.update(
      { id: userId },
      { pinHash: hash, failedPinAttempts: 0, pinLockedUntil: null },
    );
    this.logger.log(`PIN ${user.pinHash ? 'changed' : 'set'} for user=${userId}`);
  }

  /**
   * Verify a PIN. Tracks failed attempts; locks out after MAX_FAILED_ATTEMPTS.
   * Throws on invalid PIN, locked account, or unset PIN.
   */
  async verifyPin(userId: string, pin: string): Promise<void> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();
    if (!user.pinHash) {
      throw new BadRequestException('PIN not set. Please set up your PIN first.');
    }

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.pinLockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new ForbiddenException(`PIN locked. Try again in ${minutesLeft} min.`);
    }

    const ok = await argon2.verify(user.pinHash, pin);
    if (!ok) {
      const attempts = user.failedPinAttempts + 1;
      const updates: Partial<User> = { failedPinAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        updates.pinLockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        updates.failedPinAttempts = 0;
        this.logger.warn(`PIN locked for user=${userId} after ${attempts} failed attempts`);
      }
      await this.users.update({ id: userId }, updates);
      throw new UnauthorizedException(
        attempts >= MAX_FAILED_ATTEMPTS
          ? `PIN locked for ${LOCKOUT_MINUTES} minutes`
          : `Wrong PIN. ${MAX_FAILED_ATTEMPTS - attempts} attempts remaining.`,
      );
    }

    if (user.failedPinAttempts > 0) {
      await this.users.update({ id: userId }, { failedPinAttempts: 0 });
    }
  }

  async hasPin(userId: string): Promise<boolean> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    return !!user?.pinHash;
  }

  private isWeakPin(pin: string): boolean {
    const weak = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
                  '1234', '4321', '0123', '1122', '1212'];
    return weak.includes(pin);
  }
}
