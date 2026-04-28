import { api } from './client';
import { generateIdempotencyKey } from '@/utils/idempotency';

export interface Wallet {
  id: string;
  currency: string;
  balance: number;
  availableBalance: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

export interface Transaction {
  id: string;
  walletId: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REVERSED';
  amount: number;
  fee: number;
  currency: string;
  channel?: string | null;
  counterpartyName?: string | null;
  counterpartyPhone?: string | null;
  description?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export const walletApi = {
  async getMine(): Promise<Wallet> {
    const { data } = await api.get('/wallet');
    return data.data;
  },

  async listTransactions(page = 1, pageSize = 20) {
    const { data } = await api.get('/wallet/transactions', { params: { page, pageSize } });
    return data as { data: Transaction[]; meta: { total: number; page: number; pageSize: number } };
  },

  async transfer(input: { toPhone: string; amount: number; description?: string }) {
    const { data } = await api.post('/wallet/transfer', input, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.data as { transactionId: string };
  },

  async initiateTopup(input: {
    amount: number;
    channel: 'AIRTEL_MONEY' | 'MOOV_MONEY' | 'CARD_VISA' | 'CARD_MASTERCARD';
    description?: string;
  }) {
    const { data } = await api.post('/wallet/topup', input, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.data as { transactionId: string; checkoutUrl: string };
  },

  async getTopupStatus(transactionId: string) {
    const { data } = await api.get(`/wallet/topup/${transactionId}`);
    return data.data as {
      transactionId: string;
      status: string;
      amount: number;
      completedAt: string | null;
    };
  },
};
