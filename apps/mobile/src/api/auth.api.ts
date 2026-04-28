import { api } from './client';

export type OtpPurpose =
  | 'SIGNUP'
  | 'LOGIN'
  | 'PHONE_CHANGE'
  | 'PIN_RESET'
  | 'TRANSACTION_CONFIRM';

export interface VerifyResult {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  isNewUser: boolean;
}

export const authApi = {
  async requestOtp(phone: string, purpose: OtpPurpose, countryCode = 'GA') {
    const { data } = await api.post('/auth/request-otp', { phone, purpose, countryCode });
    return data.data as { expiresInSeconds: number };
  },

  async verifyOtp(phone: string, code: string, purpose: OtpPurpose) {
    const { data } = await api.post('/auth/verify-otp', { phone, code, purpose });
    return data.data as VerifyResult;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // best-effort
    }
  },

  async me() {
    const { data } = await api.get('/users/me');
    return data.data;
  },
};
