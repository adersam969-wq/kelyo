import { api } from './client';
import { generateIdempotencyKey } from '@/utils/idempotency';

export const paymentsApi = {
  async payByQr(input: { qrPayload: string; amountIfStatic?: number; description?: string }) {
    const { data } = await api.post('/payments/pay-qr', input, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.data as { transactionId: string; amount: number; merchantName: string };
  },

  async payByLink(slug: string) {
    const { data } = await api.post(
      '/payments/pay-link',
      { slug },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return data.data as { transactionId: string; amount: number; merchantName: string };
  },

  async getPaymentLink(slug: string) {
    const { data } = await api.get(`/payment-links/${slug}`);
    return data.data as {
      slug: string;
      merchantName: string;
      amount: number;
      currency: string;
      description: string;
      status: string;
      expiresAt: string | null;
    };
  },

  async createQr(input: {
    type: 'STATIC' | 'DYNAMIC';
    amount?: number;
    description?: string;
    expiresAt?: string;
  }) {
    const { data } = await api.post('/merchant/qr', input);
    return data.data as {
      id: string;
      type: 'STATIC' | 'DYNAMIC';
      amount: number | null;
      currency: string;
      payload: string;
      status: string;
      expiresAt: string | null;
    };
  },

  async listQr(page = 1, pageSize = 20) {
    const { data } = await api.get('/merchant/qr', { params: { page, pageSize } });
    return data;
  },

  async createPaymentLink(input: { amount: number; description: string; expiresAt?: string }) {
    const { data } = await api.post('/merchant/payment-links', input);
    return data.data;
  },
};
