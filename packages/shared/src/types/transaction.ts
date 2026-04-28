import type { Currency } from './wallet';

export enum TransactionType {
  TOPUP = 'TOPUP', // wallet recharge from external source
  WITHDRAWAL = 'WITHDRAWAL', // wallet to external Mobile Money
  TRANSFER_OUT = 'TRANSFER_OUT', // P2P send
  TRANSFER_IN = 'TRANSFER_IN', // P2P receive
  PAYMENT = 'PAYMENT', // pay a merchant
  COLLECTION = 'COLLECTION', // merchant receives a payment
  FEE = 'FEE', // fee deduction
  REVERSAL = 'REVERSAL', // reversed transaction
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REVERSED = 'REVERSED',
}

export enum PaymentChannel {
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  CARD_VISA = 'CARD_VISA',
  CARD_MASTERCARD = 'CARD_MASTERCARD',
  KELYO_WALLET = 'KELYO_WALLET',
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee: number;
  currency: Currency;
  channel?: PaymentChannel | null;
  counterpartyName?: string | null;
  counterpartyPhone?: string | null;
  description?: string | null;
  externalRef?: string | null; // CinetPay transaction id
  metadata?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string | null;
}
