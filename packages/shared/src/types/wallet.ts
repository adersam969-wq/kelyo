export type Currency = 'XAF' | 'XOF' | 'USD' | 'EUR';

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

export interface Wallet {
  id: string;
  userId: string;
  currency: Currency;
  balance: number; // in smallest currency unit (XAF has no subunit, but we keep integers)
  availableBalance: number; // balance minus pending holds
  status: WalletStatus;
  createdAt: string;
}
