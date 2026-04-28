import type { Currency } from './wallet';

export enum QrCodeType {
  STATIC = 'STATIC', // amount entered by payer
  DYNAMIC = 'DYNAMIC', // amount fixed by merchant
}

export enum QrCodeStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface QrCode {
  id: string;
  merchantId: string;
  type: QrCodeType;
  amount?: number | null;
  currency: Currency;
  description?: string | null;
  status: QrCodeStatus;
  payload: string; // encoded string for the QR
  expiresAt?: string | null;
  createdAt: string;
}

export enum PaymentLinkStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface PaymentLink {
  id: string;
  merchantId: string;
  slug: string; // public URL slug
  amount: number;
  currency: Currency;
  description: string;
  status: PaymentLinkStatus;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}
