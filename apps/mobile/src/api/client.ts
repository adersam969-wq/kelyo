import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  'http://localhost:3000/api/v1';

export const ACCESS_TOKEN_KEY = 'kelyo_access_token';
export const REFRESH_TOKEN_KEY = 'kelyo_refresh_token';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401 (Phase 1 will fully implement /auth/refresh)
let isRefreshing = false;
let queue: Array<(t: string | null) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          queue.push((token) => {
            if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newAccess = data?.data?.accessToken;
        if (newAccess) {
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccess);
          queue.forEach((cb) => cb(newAccess));
          queue = [];
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        }
      } catch (e) {
        queue.forEach((cb) => cb(null));
        queue = [];
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        throw e;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
