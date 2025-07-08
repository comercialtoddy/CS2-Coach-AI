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