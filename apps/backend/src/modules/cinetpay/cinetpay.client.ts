import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CinetPayCheckResponse,
  CinetPayInitPaymentRequest,
  CinetPayInitPaymentResponse,
  CinetPayTransferRequest,
} from './types';

/**
 * CinetPay client — wraps HTTP calls to their REST API.
 *
 * Two endpoints used:
 *  - Checkout: /v2/payment + /v2/payment/check
 *  - Transfer: /v1/transfer/money/send
 *
 * All requests are authenticated via apikey + site_id in the body (their convention).
 *
 * Webhook signature verification:
 *   CinetPay sends an HMAC-SHA256 of specific fields concatenated, signed with
 *   our secret key, in the `x-token` header.
 */
@Injectable()
export class CinetPayClient {
  private readonly logger = new Logger(CinetPayClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      timeout: 20_000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        const status = err.response?.status;
        const body = err.response?.data;
        this.logger.error(
          `CinetPay HTTP error: status=${status} body=${JSON.stringify(body)}`,
        );
        return Promise.reject(err);
      },
    );
  }

  /**
   * Initialize a payment session. Returns the URL the user is redirected to.
   *
   * CinetPay constraint for XAF: amount must be a multiple of 5 and ≥ 100.
   */
  async initializePayment(
    input: Omit<CinetPayInitPaymentRequest, 'apikey' | 'site_id' | 'notify_url' | 'return_url'>,
  ): Promise<CinetPayInitPaymentResponse> {
    const apiUrl = this.config.get<string>('cinetpay.apiUrl')!;
    const body: CinetPayInitPaymentRequest = {
      ...input,
      apikey: this.config.get<string>('cinetpay.apiKey')!,
      site_id: this.config.get<string>('cinetpay.siteId')!,
      notify_url: this.config.get<string>('cinetpay.notifyUrl')!,
      return_url: this.config.get<string>('cinetpay.returnUrl')!,
    };

    if (body.currency === 'XAF' && (body.amount < 100 || body.amount % 5 !== 0)) {
      throw new Error('CinetPay: XAF amount must be ≥ 100 and a multiple of 5');
    }

    try {
      const { data } = await this.http.post<CinetPayInitPaymentResponse>(apiUrl, body);
      if (data.code !== '201') {
        throw new Error(`CinetPay init failed: code=${data.code} message=${data.message}`);
      }
      return data;
    } catch (err) {
      throw new ServiceUnavailableException('Payment provider unavailable');
    }
  }

  /**
   * Independently check a transaction status — used inside webhook handlers
   * as a defense-in-depth measure (don't trust the webhook payload alone).
   */
  async checkPayment(transactionId: string): Promise<CinetPayCheckResponse> {
    const apiUrl = this.config.get<string>('cinetpay.apiUrl')!.replace(/\/payment$/, '/payment/check');
    const body = {
      apikey: this.config.get<string>('cinetpay.apiKey'),
      site_id: this.config.get<string>('cinetpay.siteId'),
      transaction_id: transactionId,
    };
    const { data } = await this.http.post<CinetPayCheckResponse>(apiUrl, body);
    return data;
  }

  /**
   * Initiate an outbound transfer (withdrawal to Mobile Money).
   * Note: CinetPay's transfer API requires a separate "balance" account that must
   * be funded before transfers can succeed. Set this up in their merchant portal.
   */
  async initiateTransfer(input: Omit<CinetPayTransferRequest, 'notify_url'>) {
    const transferUrl = `${this.config.get<string>('cinetpay.transferApiUrl')}/transfer/money/send/contact`;
    const body = {
      ...input,
      notify_url: this.config.get<string>('cinetpay.notifyUrl'),
      apikey: this.config.get<string>('cinetpay.apiKey'),
      site_id: this.config.get<string>('cinetpay.siteId'),
    };
    const { data } = await this.http.post(transferUrl, body);
    return data;
  }

  /**
   * Verify a webhook signature. CinetPay's signing scheme:
   *
   *  signature = HMAC_SHA256(
   *    cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount + cpm_currency
   *    + signature + payment_method + cel_phone_num + cpm_phone_prefixe
   *    + cpm_language + cpm_version + cpm_payment_config + cpm_page_action
   *    + cpm_custom + cpm_designation + cpm_error_message,
   *    secret_key,
   *  )
   *
   * The token is sent in the `x-token` header. We re-compute and compare in
   * constant time. Mismatch → reject the webhook.
   */
  verifyWebhookSignature(payload: Record<string, unknown>, providedToken: string): boolean {
    if (!providedToken) return false;

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

    const concatenated = fields.map((f) => (payload[f] as string | undefined) ?? '').join('');
    const expected = createHmac('sha256', this.config.get<string>('cinetpay.secretKey') ?? '')
      .update(concatenated)
      .digest('hex');

    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(providedToken, 'hex');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
