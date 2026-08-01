import api from '../lib/api';
import type { User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const AuthService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post('/auth/login', payload);
    return data.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
  },

  async me(): Promise<User> {
    const { data } = await api.get('/auth/me');
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async updateProfile(payload: { name?: string; avatar?: string }): Promise<User> {
    const { data } = await api.put('/auth/profile', payload);
    return data.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', { currentPassword, newPassword });
  },

  async forgotPassword(email: string): Promise<{ resetToken?: string }> {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  },
};
