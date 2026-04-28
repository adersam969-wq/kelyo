import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { User, KycTier, UserRole } from "./entities/user.entity";
import { Wallet, WalletStatus } from "../wallet/entities/wallet.entity";
import { randomInt } from "crypto";

const RESERVED_USERNAMES = [
  "kelyo", "admin", "support", "help", "system", "root", "staff",
  "official", "team", "contact", "info", "service",
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.users.findOne({ where: { phone } });
  }

  async findByKelyoId(kelyoId: string): Promise<User | null> {
    const normalized = kelyoId.trim().toUpperCase().replace(/[\s-]/g, "");
    return this.users.findOne({ where: { kelyoId: normalized } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.findOne({ where: { username: username.toLowerCase() } });
  }

  async findRecipient(input: string): Promise<User | null> {
    const trimmed = input.trim();
    if (trimmed.startsWith("+")) return this.findByPhone(trimmed);
    if (/^KEL\d{8}$/i.test(trimmed.replace(/[\s-]/g, ""))) {
      return this.findByKelyoId(trimmed);
    }
    if (trimmed.startsWith("@")) return this.findByUsername(trimmed.slice(1));
    return null;
  }

  async createWithWallet(input: {
    phone: string;
    countryCode: string;
    role?: UserRole;
  }): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const kelyoId = await this.generateUniqueKelyoId(manager);
      const user = manager.getRepository(User).create({
        phone: input.phone,
        countryCode: input.countryCode,
        role: input.role ?? UserRole.USER,
        isPhoneVerified: true,
        kycTier: KycTier.TIER_0,
        kelyoId,
      });
      const saved = await manager.getRepository(User).save(user);

      const wallet = manager.getRepository(Wallet).create({
        userId: saved.id,
        currency: "XAF",
        balance: 0,
        availableBalance: 0,
        status: WalletStatus.ACTIVE,
      });
      await manager.getRepository(Wallet).save(wallet);

      return saved;
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  async setUsername(userId: string, rawUsername: string): Promise<{ username: string }> {
    const username = rawUsername.toLowerCase().trim().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      throw new BadRequestException(
        "Username must be 3-20 characters (lowercase letters, numbers, underscore)",
      );
    }
    if (RESERVED_USERNAMES.includes(username)) {
      throw new ConflictException("This username is reserved");
    }
    const existing = await this.users.findOne({ where: { username } });
    if (existing && existing.id !== userId) {
      throw new ConflictException("This username is already taken");
    }
    await this.users.update({ id: userId }, { username });
    return { username };
  }

  async checkUsernameAvailability(rawUsername: string): Promise<{ available: boolean; reason?: string }> {
    const username = rawUsername.toLowerCase().trim().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return { available: false, reason: "Format invalide" };
    }
    if (RESERVED_USERNAMES.includes(username)) {
      return { available: false, reason: "Reservé" };
    }
    const existing = await this.users.findOne({ where: { username } });
    return existing
      ? { available: false, reason: "Déjà pris" }
      : { available: true };
  }

  private async generateUniqueKelyoId(manager: any): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const digits = String(randomInt(10_000_000, 99_999_999));
      const kelyoId = "KEL" + digits;
      const exists = await manager
        .getRepository(User)
        .findOne({ where: { kelyoId } });
      if (!exists) return kelyoId;
    }
    throw new Error("Could not generate unique Kelyo ID after 10 attempts");
  }

  async updateProfile(userId: string, firstName: string, lastName: string): Promise<{ firstName: string; lastName: string }> {
    const cleanFirst = firstName.trim().slice(0, 100);
    const cleanLast = lastName.trim().slice(0, 100);
    if (!cleanFirst || !cleanLast) {
      throw new BadRequestException("First and last name required");
    }
    await this.users.update({ id: userId }, { firstName: cleanFirst, lastName: cleanLast });
    return { firstName: cleanFirst, lastName: cleanLast };
  }
}
