import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";

export enum UserRole {
  USER = "USER",
  MERCHANT = "MERCHANT",
  ADMIN = "ADMIN",
}

export enum KycTier {
  TIER_0 = "TIER_0",
  TIER_1 = "TIER_1",
  TIER_2 = "TIER_2",
}

export enum KycStatus {
  NOT_SUBMITTED = "NOT_SUBMITTED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("users")
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: "varchar", length: 20, unique: true })
  phone!: string;

  @Index({ unique: true })
  @Column({ name: "kelyo_id", type: "varchar", length: 11 })
  kelyoId!: string;

  @Column({ type: "citext", nullable: true })
  username?: string | null;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: "varchar", length: 255, nullable: true })
  email?: string | null;

  @Column({ name: "pin_hash", type: "varchar", length: 255, nullable: true, select: false })
  pinHash?: string | null;

  @Column({ name: "first_name", type: "varchar", length: 100, nullable: true })
  firstName?: string | null;

  @Column({ name: "last_name", type: "varchar", length: 100, nullable: true })
  lastName?: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ name: "kyc_tier", type: "enum", enum: KycTier, default: KycTier.TIER_0 })
  kycTier!: KycTier;

  @Column({ name: "kyc_status", type: "enum", enum: KycStatus, default: KycStatus.NOT_SUBMITTED })
  kycStatus!: KycStatus;

  @Column({ name: "is_phone_verified", type: "boolean", default: false })
  isPhoneVerified!: boolean;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "country_code", type: "varchar", length: 2, default: "GA" })
  countryCode!: string;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt?: Date | null;

  @Column({ name: "failed_pin_attempts", type: "int", default: 0 })
  failedPinAttempts!: number;

  @Column({ name: "pin_locked_until", type: "timestamptz", nullable: true })
  pinLockedUntil?: Date | null;
}
