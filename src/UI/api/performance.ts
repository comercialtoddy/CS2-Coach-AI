import { apiV2 } from './api';

export interface PerformanceStats {
  winRate: number;
  kdRatio: number;
  adr: number;
  headshotPercentage: number;
  recentMatches: MatchStats[];
}

export interface MatchStats {
  id: string;
  map: string;
  date: string;
  result: 'win' | 'loss';
  score: {
    team: number;
    opponent: number;
  };
  performance: {
    kills: number;
    deaths: number;
    assists: number;
    adr: number;
    hs: number;
  };
}

export interface MapStats {
  map: string;
  winRate: number;
  tSideWinRate: number;
  ctSideWinRate: number;
  entrySuccessRate: number;
  commonPositions: {
    position: string;
    successRate: number;
  }[];
  commonAngles: {
    angle: string;
    kills: number;
  }[];
}

export interface WeaponStats {
  name: string;
  type: 'Rifle' | 'SMG' | 'Pistol' | 'Sniper' | 'Heavy';
  kills: number;
  accuracy: number;
  headshots: number;
  damage: number;
}

export interface Settings {
  voice: {
    model: string;
    volume: number;
  };
  ai: {
    model: string;
    responseStyle: 'concise' | 'detailed' | 'coaching';
  };
  display: {
    showWinLossStreak: boolean;
    showPerformanceTrends: boolean;
    showMatchDetails: boolean;
  };
  notifications: {
    performanceMilestones: boolean;
    matchAnalysis: boolean;
    personalRecords: boolean;
  };
}

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