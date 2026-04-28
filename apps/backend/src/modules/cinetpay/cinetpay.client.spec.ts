import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { CinetPayClient } from './cinetpay.client';

describe('CinetPayClient.verifyWebhookSignature', () => {
  const SECRET = 'test_secret_key_change_in_prod_aaaaaaaaaa';
  let client: CinetPayClient;

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        if (key === 'cinetpay.secretKey') return SECRET;
        return undefined;
      },
    } as unknown as ConfigService;
    client = new CinetPayClient(config);
  });

  function makePayload(over: Partial<Record<string, string>> = {}) {
    return {
      cpm_site_id: '123456',
      cpm_trans_id: 'tx-abc',
      cpm_trans_date: '20260425160000',
      cpm_amount: '5000',
      cpm_currency: 'XAF',
      signature: 'sig',
      payment_method: 'OMCI',
      cel_phone_num: '241071234567',
      cpm_phone_prefixe: '241',
      cpm_language: 'fr',
      cpm_version: 'V4',
      cpm_payment_config: 'SINGLE',
      cpm_page_action: 'PAYMENT',
      cpm_custom: '',
      cpm_designation: 'Recharge wallet',
      cpm_error_message: '',
      ...over,
    };
  }

  function computeExpected(payload: Record<string, string>): string {
    const fields = [
      'cpm_site_id',
      'cpm_trans_id',
      'cpm_trans_date',
      'cpm_amount',
      'cpm_currency',
      'signature',
      'payment_method',
      'cel_phone_num',
      'cpm_phone_prefixe',
      'cpm_language',
      'cpm_version',
      'cpm_payment_config',
      'cpm_page_action',
      'cpm_custom',
      'cpm_designation',
      'cpm_error_message',
    ];
    const data = fields.map((f) => payload[f] ?? '').join('');
    return createHmac('sha256', SECRET).update(data).digest('hex');
  }

  it('accepts a correctly signed payload', () => {
    const payload = makePayload();
    const valid = computeExpected(payload);
    expect(client.verifyWebhookSignature(payload, valid)).toBe(true);
  });

  it('rejects a tampered amount', () => {
    const payload = makePayload();
    const valid = computeExpected(payload);
    const tampered = { ...payload, cpm_amount: '999999' };
    expect(client.verifyWebhookSignature(tampered, valid)).toBe(false);
  });

  it('rejects an empty token', () => {
    const payload = makePayload();
    expect(client.verifyWebhookSignature(payload, '')).toBe(false);
  });

  it('rejects a malformed token', () => {
    const payload = makePayload();
    expect(client.verifyWebhookSignature(payload, 'not-hex-zzz')).toBe(false);
  });

  it('rejects a token of the wrong length', () => {
    const payload = makePayload();
    expect(client.verifyWebhookSignature(payload, 'aabbcc')).toBe(false);
  });

  it('rejects when the wrong secret was used to sign', () => {
    const payload = makePayload();
    const fields = [
      'cpm_site_id',
      'cpm_trans_id',
      'cpm_trans_date',
      'cpm_amount',
      'cpm_currency',
      'signature',
      'payment_method',
      'cel_phone_num',
      'cpm_phone_prefixe',
      'cpm_language',
      'cpm_version',
      'cpm_payment_config',
      'cpm_page_action',
      'cpm_custom',
      'cpm_designation',
      'cpm_error_message',
    ];
    const data = fields.map((f) => (payload as any)[f] ?? '').join('');
    const wrongSecret = createHmac('sha256', 'attacker_secret').update(data).digest('hex');
    expect(client.verifyWebhookSignature(payload, wrongSecret)).toBe(false);
  });
});
