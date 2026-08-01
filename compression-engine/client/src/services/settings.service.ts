import api from '../lib/api';
import type { Settings, ApiKeyRecord } from '../types';

export const SettingsService = {
  async get(): Promise<Settings> {
    const { data } = await api.get('/settings');
    return data.data;
  },

  async update(payload: Partial<Omit<Settings, 'apiKeys'>>): Promise<Partial<Settings>> {
    const { data } = await api.put('/settings', payload);
    return data.data;
  },

  async addApiKey(payload: { provider: string; key: string; label?: string }): Promise<ApiKeyRecord> {
    const { data } = await api.post('/settings/api-keys', payload);
    return data.data;
  },

  async deleteApiKey(id: string): Promise<void> {
    await api.delete(`/settings/api-keys/${id}`);
  },

  async toggleApiKey(id: string): Promise<ApiKeyRecord> {
    const { data } = await api.put(`/settings/api-keys/${id}/toggle`);
    return data.data;
  },
};
