import React, { useEffect } from 'react';
import { usePerformance } from '../../hooks';
import { BarChart } from '../../components/charts';

interface WeaponStat {
  name: string;
  type: 'Rifle' | 'SMG' | 'Pistol' | 'Sniper' | 'Heavy';
  kills: number;
  accuracy: number;
  headshots: number;
  damage: number;
}

/**
 * Weapon Analysis Section
 * 
 * Displays performance statistics for each weapon:
 * - Accuracy
 * - Headshot percentage
 * - Average damage
 * - Kill count
 * - Preferred weapons
 */
export const WeaponAnalysis: React.FC = () => {
  const {
    weaponStats,
    isLoadingWeaponStats,
    weaponStatsError,
    loadWeaponStats
  } = usePerformance();

  const weaponTypes = ['All', 'Rifle', 'SMG', 'Pistol', 'Sniper', 'Heavy'];

  // Load initial stats
  useEffect(() => {
    loadWeaponStats();
  }, [loadWeaponStats]);

  if (isLoadingWeaponStats) {
    return (
      <div className="space-y-4">
        {/* Type Filter Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-20 h-10 bg-background-primary rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* Weapon Cards Skeleton */}
        <div className="bg-background-primary rounded-lg p-4">
          <div className="h-6 w-40 bg-background-secondary rounded mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-background-secondary rounded-lg p-4 animate-pulse"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="h-6 w-24 bg-background-primary rounded" />
                  <div className="h-4 w-16 bg-background-primary rounded" />
                </div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <div
                      key={j}
                      className="flex justify-between items-center"
                    >
                      <div className="h-4 w-20 bg-background-primary rounded" />
                      <div className="h-4 w-12 bg-background-primary rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (weaponStatsError) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Weapon Stats</h3>
        <p className="mb-4">{weaponStatsError.message}</p>
        <button
          onClick={() => loadWeaponStats()}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Transform weapon stats into chart data
  const killData = weaponStats.map(weapon => ({
    name: weapon.name,
    value: weapon.kills,
    type: weapon.type
  }));

  const accuracyData = weaponStats.map(weapon => ({
    name: weapon.name,
    value: weapon.accuracy,
    type: weapon.type
  }));

  const headshotData = weaponStats.map(weapon => ({
    name: weapon.name,
    value: (weapon.headshots / weapon.kills) * 100,
    type: weapon.type
  }));

  return (
    <div className="space-y-4">
      {/* Weapon Type Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weaponTypes.map(type => (
          <button
            key={type}
            onClick={() => loadWeaponStats(type === 'All' ? undefined : type)}
            className="px-4 py-2 rounded-lg bg-background-primary hover:bg-primary hover:text-white transition-colors"
          >
            {type}
          </button>
        ))}
      </div>

      {/* Most Used Weapons */}
      <div className="bg-background-primary rounded-lg p-4">
        <BarChart
          data={killData}
          title="Weapon Usage"
          yAxisLabel="Total Kills"
          height={300}
          horizontal
        />
      </div>

      {/* Accuracy Trends */}
      <div className="bg-background-primary rounded-lg p-4">
        <BarChart
          data={accuracyData}
          title="Weapon Accuracy"
          yAxisLabel="Accuracy (%)"
          height={300}
          horizontal
        />
      </div>

      {/* Weapon Comparison */}
      <div className="bg-background-primary rounded-lg p-4">
        <BarChart
          data={headshotData}
          title="Headshot Percentage"
          yAxisLabel="Headshot %"
          height={300}
          horizontal
        />
      </div>
    </div>
  );
}; 