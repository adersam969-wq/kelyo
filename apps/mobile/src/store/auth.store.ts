import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/api/client';

const USER_KEY = 'kelyo_user';

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'USER' | 'MERCHANT' | 'ADMIN';
  kycTier: 'TIER_0' | 'TIER_1' | 'TIER_2';
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface AuthState {
  user: User | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      const access = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (raw && access) {
        set({ user: JSON.parse(raw) as User, isHydrated: true });
      } else {
        set({ user: null, isHydrated: true });
      }
    } catch {
      set({ user: null, isHydrated: true });
    }
  },

  setSession: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  setUser: async (user) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null });
  },
}));
