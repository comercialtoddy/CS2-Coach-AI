import React, { useEffect } from 'react';
import { usePerformance } from '../../hooks';
import { RadarChart, BarChart } from '../../components/charts';

/**
 * Map Analysis Section
 * 
 * Displays performance statistics for each map:
 * - Win rate per map
 * - Most played positions
 * - Common angles held
 * - Entry success rate
 * - Round win rate (T/CT sides)
 */
export const MapAnalysis: React.FC = () => {
  const {
    mapStats,
    isLoadingMapStats,
    mapStatsError,
    loadMapStats
  } = usePerformance();

  const maps = [
    'Ancient',
    'Anubis',
    'Inferno',
    'Mirage',
    'Nuke',
    'Overpass',
    'Vertigo'
  ];

  // Load initial stats
  useEffect(() => {
    loadMapStats();
  }, [loadMapStats]);

  if (isLoadingMapStats) {
    return (
      <div className="space-y-4">
        {/* Map Selection Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-24 h-10 bg-background-primary rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-background-primary rounded-lg p-4 animate-pulse"
            >
              <div className="h-6 w-32 bg-background-secondary rounded mb-4" />
              <div className="h-8 w-16 bg-background-secondary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mapStatsError) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Map Stats</h3>
        <p className="mb-4">{mapStatsError.message}</p>
        <button
          onClick={() => loadMapStats()}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const selectedMap = mapStats[0]; // For now, show first map's stats

  // Transform map stats into chart data
  const mapWinRates = mapStats.map(map => ({
    name: map.map,
    value: map.winRate
  }));

  const positionData = selectedMap?.commonPositions.map(pos => ({
    subject: pos.position,
    value: pos.successRate,
    fullMark: 100
  })) || [];

  const angleData = selectedMap?.commonAngles.map(angle => ({
    name: angle.angle,
    value: angle.kills
  })) || [];

  return (
    <div className="space-y-4">
      {/* Map Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {maps.map(map => (
          <button
            key={map}
            onClick={() => loadMapStats(map)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedMap?.map === map
                ? 'bg-primary text-white'
                : 'bg-background-primary hover:bg-primary hover:text-white'
            }`}
          >
            {map}
          </button>
        ))}
      </div>

      {selectedMap && (
        <>
          {/* Map Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Win Rate Card */}
            <div className="bg-background-primary rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Map Win Rate</h3>
              <div className="text-3xl font-bold text-primary">
                {selectedMap.winRate.toFixed(1)}%
              </div>
              <div className="text-sm text-text-secondary">
                Last 20 matches on {selectedMap.map}
              </div>
            </div>

            {/* Side Win Rates */}
            <div className="bg-background-primary rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Side Performance</h3>
              <div className="space-y-2">
                <div>
                  <div className="text-sm text-text-secondary">T Side</div>
                  <div className="text-xl font-bold text-primary">
                    {selectedMap.tSideWinRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-text-secondary">CT Side</div>
                  <div className="text-xl font-bold text-primary">
                    {selectedMap.ctSideWinRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Entry Success */}
            <div className="bg-background-primary rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Entry Success Rate</h3>
              <div className="text-3xl font-bold text-primary">
                {selectedMap.entrySuccessRate.toFixed(1)}%
              </div>
              <div className="text-sm text-text-secondary">
                First engagement win rate
              </div>
            </div>
          </div>

          {/* Map Win Rates */}
          <div className="bg-background-primary rounded-lg p-4">
            <BarChart
              data={mapWinRates}
              title="Win Rate by Map"
              yAxisLabel="Win Rate (%)"
              height={240}
            />
          </div>

          {/* Position Analysis */}
          <div className="bg-background-primary rounded-lg p-4">
            <RadarChart
              data={positionData}
              title="Position Success Rates"
              height={400}
            />
          </div>

          {/* Common Angles */}
          <div className="bg-background-primary rounded-lg p-4">
            <BarChart
              data={angleData}
              title="Common Angles"
              yAxisLabel="Kills"
              height={240}
              horizontal
            />
          </div>
        </>
      )}
    </div>
  );
}; 