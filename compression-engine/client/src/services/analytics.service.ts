import api from '../lib/api';
import type { OverviewAnalytics, TrendData, DocTypeData } from '../types';

export interface UsageData {
  date: string;
  count: number;
  savings: number;
  tokens: number;
}

export const AnalyticsService = {
  async getOverview(): Promise<OverviewAnalytics> {
    const { data } = await api.get('/analytics/overview');
    return data.data;
  },

  async getTrends(period: string = '30'): Promise<TrendData[]> {
    const { data } = await api.get(`/analytics/trends?period=${period}`);
    return data.data;
  },

  async getDocumentTypes(): Promise<DocTypeData[]> {
    const { data } = await api.get('/analytics/document-types');
    return data.data;
  },

  async getUsage(): Promise<{ daily: UsageData[] }> {
    const { data } = await api.get('/analytics/usage');
    return data.data;
  },
};
