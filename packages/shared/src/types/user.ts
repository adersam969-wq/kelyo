export enum UserRole {
  USER = 'USER',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN',
}

export enum KycTier {
  TIER_0 = 'TIER_0', // phone-verified only
  TIER_1 = 'TIER_1', // ID document approved
  TIER_2 = 'TIER_2', // full KYC (ID + selfie + address)
}

export enum KycStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  kycTier: KycTier;
  kycStatus: KycStatus;
  isPhoneVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MerchantProfile {
  userId: string;
  businessName: string;
  businessType: string;
  rccmNumber?: string | null;
  logoUrl?: string | null;
  city?: string | null;
  country: string; // ISO-2
}
