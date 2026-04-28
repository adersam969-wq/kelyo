import { registerAs } from '@nestjs/config';

export default registerAs('cinetpay', () => ({
  apiKey: process.env.CINETPAY_API_KEY || '',
  siteId: process.env.CINETPAY_SITE_ID || '',
  secretKey: process.env.CINETPAY_SECRET_KEY || '',
  apiUrl: process.env.CINETPAY_API_URL || 'https://api-checkout.cinetpay.com/v2/payment',
  transferApiUrl: process.env.CINETPAY_TRANSFER_API_URL || 'https://client.cinetpay.com/v1',
  notifyUrl: process.env.CINETPAY_NOTIFY_URL || '',
  returnUrl: process.env.CINETPAY_RETURN_URL || '',
  mode: (process.env.CINETPAY_MODE as 'TEST' | 'PRODUCTION') || 'TEST',
  defaultCurrency: 'XAF', // Central African CFA franc
}));
