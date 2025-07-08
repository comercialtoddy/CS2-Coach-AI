import { apiV2 } from './api';
import type {
  PerformanceStats,
  MapStats,
  WeaponStats,
  MatchStats,
  Settings
} from '../../types/performance.js';

export type {
  PerformanceStats,
  MapStats,
  WeaponStats,
  MatchStats,
  Settings
};

const performance = {
  stats: {
    getOverview: async (): Promise<PerformanceStats> =>
      apiV2('/performance/overview'),

    getMapStats: async (map?: string): Promise<MapStats[]> =>
      apiV2(`/performance/maps${map ? `/${map}` : ''}`),

    getWeaponStats: async (type?: string): Promise<WeaponStats[]> =>
      apiV2(`/performance/weapons${type ? `?type=${type}` : ''}`),

    getMatchHistory: async (
      page = 1,
      filters?: {
        map?: string;
        result?: 'win' | 'loss';
      }
    ): Promise<{
      matches: MatchStats[];
      total: number;
      hasMore: boolean;
    }> => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        ...(filters?.map && { map: filters.map }),
        ...(filters?.result && { result: filters.result }),
      });

      return apiV2(`/performance/matches?${queryParams}`);
    },
  },

  settings: {
    get: async (): Promise<Settings> =>
      apiV2('/performance/settings'),

    update: async (settings: Partial<Settings>): Promise<Settings> =>
      apiV2('/performance/settings', 'PUT', settings),
  },
};

export default performance; 