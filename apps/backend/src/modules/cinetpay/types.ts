/**
 * CinetPay API types.
 *
 * Reference: https://docs.cinetpay.com
 *
 * We use:
 *  - /v2/payment             → initialize a checkout (top-up)
 *  - /v2/payment/check       → verify a transaction status independently
 *  - /v1/transfer/money/send → outbound transfer (withdrawal)
 *  - Webhooks                → async notification of status changes
 */

export interface CinetPayInitPaymentRequest {
  apikey: string;
  site_id: string;
  transaction_id: string; // our internal id
  amount: number; // XAF (multiple of 5 required by CinetPay for XAF)
  currency: 'XAF' | 'XOF' | 'CDF' | 'GNF' | 'USD';
  description: string;
  notify_url: string;
  return_url: string;
  channels: 'ALL' | 'MOBILE_MONEY' | 'CREDIT_CARD' | 'WALLET';
  customer_name?: string;
  customer_surname?: string;
  customer_email?: string;
  customer_phone_number?: string;
  customer_address?: string;
  customer_city?: string;
  customer_country?: string;
  customer_state?: string;
  customer_zip_code?: string;
  metadata?: string;
  lang?: 'fr' | 'en';
  invoice_data?: Record<string, string>;
}

export interface CinetPayInitPaymentResponse {
  code: string; // '201' on success
  message: string;
  description: string;
  api_response_id: string;
  data: {
    payment_token: string;
    payment_url: string;
  };
}

export interface CinetPayCheckResponse {
  code: string; // '00' = SUCCESS, '627' = REFUSED, etc.
  message: string;
  data: {
    amount: string;
    currency: string;
    status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELED';
    payment_method: string;
    description: string;
    metadata?: string;
    operator_id?: string;
    payment_date?: string;
    fund_availability_date?: string;
    cpm_phone_prefixe?: string;
    cel_phone_num?: string;
    payment_phone_num?: string;
    cpm_result?: string;
    cpm_trans_id?: string;
    cpm_trans_date?: string;
    cpm_amount?: string;
    cpm_payid?: string;
    cpm_payment_config?: string;
    cpm_page_action?: string;
    cpm_custom?: string;
    cpm_designation?: string;
    signature?: string;
  };
}

export interface CinetPayTransferRequest {
  prefix: string; // country dial prefix without +, e.g. "241"
  phone: string; // recipient phone
  amount: number;
  notify_url: string;
  client_transaction_id: string; // our internal id
  payment_method?: 'OMCI' | 'MOMO' | 'FLOOZ' | 'AIRTEL' | 'MOOV' | 'WAVE';
  email?: string;
  name?: string;
  surname?: string;
}

export interface CinetPayWebhookPayload {
  cpm_trans_id?: string;
  cpm_site_id?: string;
  cpm_trans_date?: string;
  cpm_amount?: string;
  cpm_currency?: string;
  signature?: string;
  payment_method?: string;
  cel_phone_num?: string;
  cpm_phone_prefixe?: string;
  cpm_language?: string;
  cpm_version?: string;
  cpm_payment_config?: string;
  cpm_page_action?: string;
  cpm_custom?: string;
  cpm_designation?: string;
  cpm_error_message?: string;
  // CinetPay also sends this header: x-token (HMAC)
}

export type CinetPayPaymentStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELED';
