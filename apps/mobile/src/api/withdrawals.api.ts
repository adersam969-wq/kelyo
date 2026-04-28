import { api } from './client';
import { generateIdempotencyKey } from '@/utils/idempotency';

export type WithdrawalChannel = 'AIRTEL_MONEY' | 'MOOV_MONEY';
export type WithdrawalStatus =
  | 'PENDING_PIN'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVERSED'
  | 'EXPIRED';

export const withdrawalsApi = {
  async hasPin() {
    const { data } = await api.get('/users/me/pin');
    return data.data.hasPin as boolean;
  },

  async setPin(newPin: string, oldPin?: string) {
    await api.post('/users/me/pin', { newPin, oldPin });
  },

  async initiate(input: {
    amount: number;
    channel: WithdrawalChannel;
    recipientPhone: string;
    recipientName?: string;
  }) {
    const { data } = await api.post('/wallet/withdraw', input, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.data as {
      withdrawalId: string;
      pinExpiresInSeconds: number;
      fee: number;
    };
  },

  async confirm(withdrawalId: string, pin: string) {
    const { data } = await api.post(`/wallet/withdraw/${withdrawalId}/confirm`, { pin });
    return data.data as { status: WithdrawalStatus; transactionId: string | null };
  },

  async getStatus(withdrawalId: string) {
    const { data } = await api.get(`/wallet/withdraw/${withdrawalId}`);
    return data.data as {
      id: string;
      status: WithdrawalStatus;
      amount: number;
      fee: number;
      channel: WithdrawalChannel;
      recipientPhone: string;
      completedAt: string | null;
      failureReason: string | null;
    };
  },

  async cancel(withdrawalId: string) {
    await api.delete(`/wallet/withdraw/${withdrawalId}`);
  },
};
