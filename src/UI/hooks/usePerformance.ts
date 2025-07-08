import { useState, useEffect, useCallback } from 'react';
import performance, {
  PerformanceStats,
  MapStats,
  WeaponStats,
  MatchStats,
  Settings
} from '../api/performance';

interface UsePerformanceReturn {
  // Overview data
  overview: PerformanceStats | null;
  isLoadingOverview: boolean;
  overviewError: Error | null;
  refreshOverview: () => Promise<void>;

  // Map stats
  mapStats: MapStats[];
  isLoadingMapStats: boolean;
  mapStatsError: Error | null;
  loadMapStats: (map?: string) => Promise<void>;

  // Weapon stats
  weaponStats: WeaponStats[];
  isLoadingWeaponStats: boolean;
  weaponStatsError: Error | null;
  loadWeaponStats: (type?: string) => Promise<void>;

  // Match history
  matches: MatchStats[];
  totalMatches: number;
  hasMoreMatches: boolean;
  isLoadingMatches: boolean;
  matchesError: Error | null;
  loadMatches: (
    page?: number,
    filters?: { map?: string; result?: 'win' | 'loss' }
  ) => Promise<void>;

  // Settings
  settings: Settings | null;
  isLoadingSettings: boolean;
  settingsError: Error | null;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

export const usePerformance = (): UsePerformanceReturn => {
  // Overview state
  const [overview, setOverview] = useState<PerformanceStats | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<Error | null>(null);

  // Map stats state
  const [mapStats, setMapStats] = useState<MapStats[]>([]);
  const [isLoadingMapStats, setIsLoadingMapStats] = useState(false);
  const [mapStatsError, setMapStatsError] = useState<Error | null>(null);

  // Weapon stats state
  const [weaponStats, setWeaponStats] = useState<WeaponStats[]>([]);
  const [isLoadingWeaponStats, setIsLoadingWeaponStats] = useState(false);
  const [weaponStatsError, setWeaponStatsError] = useState<Error | null>(null);

  // Match history state
  const [matches, setMatches] = useState<MatchStats[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<Error | null>(null);

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<Error | null>(null);

  // Load overview data
  const refreshOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await performance.stats.getOverview();
      setOverview(data);
    } catch (error) {
      setOverviewError(error as Error);
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  // Load map stats
  const loadMapStats = useCallback(async (map?: string) => {
    setIsLoadingMapStats(true);
    setMapStatsError(null);
    try {
      const data = await performance.stats.getMapStats(map);
      setMapStats(data);
    } catch (error) {
      setMapStatsError(error as Error);
    } finally {
      setIsLoadingMapStats(false);
    }
  }, []);

  // Load weapon stats
  const loadWeaponStats = useCallback(async (type?: string) => {
    setIsLoadingWeaponStats(true);
    setWeaponStatsError(null);
    try {
      const data = await performance.stats.getWeaponStats(type);
      setWeaponStats(data);
    } catch (error) {
      setWeaponStatsError(error as Error);
    } finally {
      setIsLoadingWeaponStats(false);
    }
  }, []);

  // Load match history
  const loadMatches = useCallback(
    async (
      page = 1,
      filters?: { map?: string; result?: 'win' | 'loss' }
    ) => {
      setIsLoadingMatches(true);
      setMatchesError(null);
      try {
        const data = await performance.stats.getMatchHistory(page, filters);
        setMatches(page === 1 ? data.matches : [...matches, ...data.matches]);
        setTotalMatches(data.total);
        setHasMoreMatches(data.hasMore);
      } catch (error) {
        setMatchesError(error as Error);
      } finally {
        setIsLoadingMatches(false);
      }
    },
    [matches]
  );

  // Load settings
  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    try {
      const data = await performance.settings.get();
      setSettings(data);
    } catch (error) {
      setSettingsError(error as Error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    setIsLoadingSettings(true);
    setSettingsError(null);
    try {
      const data = await performance.settings.update(newSettings);
      setSettings(data);
    } catch (error) {
      setSettingsError(error as Error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    refreshOverview();
    loadSettings();
  }, [refreshOverview, loadSettings]);

  return {
    // Overview
    overview,
    isLoadingOverview,
    overviewError,
    refreshOverview,

    // Map stats
    mapStats,
    isLoadingMapStats,
    mapStatsError,
    loadMapStats,

    // Weapon stats
    weaponStats,
    isLoadingWeaponStats,
    weaponStatsError,
    loadWeaponStats,

    // Match history
    matches,
    totalMatches,
    hasMoreMatches,
    isLoadingMatches,
    matchesError,
    loadMatches,

    // Settings
    settings,
    isLoadingSettings,
    settingsError,
    loadSettings,
    updateSettings,
  };
}; 