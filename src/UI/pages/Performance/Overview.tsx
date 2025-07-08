import React from 'react';
import { usePerformance } from '../../hooks';
import { PerformanceChart } from '../../components/charts';

/**
 * Overview Section
 * 
 * Displays key performance metrics and trends:
 * - Win rate
 * - K/D ratio
 * - Average damage per round
 * - Headshot percentage
 * - Recent performance trend
 */
export const Overview: React.FC = () => {
  const {
    overview,
    isLoadingOverview,
    overviewError,
    refreshOverview
  } = usePerformance();

  if (isLoadingOverview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-background-primary rounded-lg p-4 animate-pulse">
            <div className="h-6 w-24 bg-background-secondary rounded mb-2" />
            <div className="h-8 w-16 bg-background-secondary rounded" />
            <div className="h-4 w-32 bg-background-secondary rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
        <p className="mb-4">{overviewError.message}</p>
        <button
          onClick={refreshOverview}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  // Transform recent matches into chart data
  const performanceData = overview.recentMatches.map(match => [
    {
      date: new Date(match.date).toLocaleDateString(),
      value: match.performance.kills / Math.max(1, match.performance.deaths),
      type: 'K/D Ratio'
    },
    {
      date: new Date(match.date).toLocaleDateString(),
      value: match.performance.adr,
      type: 'ADR'
    },
    {
      date: new Date(match.date).toLocaleDateString(),
      value: match.performance.hs,
      type: 'HS%'
    }
  ]).flat();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Win Rate Card */}
      <div className="bg-background-primary rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Win Rate</h3>
        <div className="text-3xl font-bold text-primary">
          {overview.winRate.toFixed(1)}%
        </div>
        <div className="text-sm text-text-secondary">Last 20 matches</div>
      </div>

      {/* K/D Ratio Card */}
      <div className="bg-background-primary rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">K/D Ratio</h3>
        <div className="text-3xl font-bold text-primary">
          {overview.kdRatio.toFixed(2)}
        </div>
        <div className="text-sm text-text-secondary">Average</div>
      </div>

      {/* ADR Card */}
      <div className="bg-background-primary rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Average Damage / Round</h3>
        <div className="text-3xl font-bold text-primary">
          {overview.adr.toFixed(1)}
        </div>
        <div className="text-sm text-text-secondary">Last 20 matches</div>
      </div>

      {/* Headshot % Card */}
      <div className="bg-background-primary rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Headshot %</h3>
        <div className="text-3xl font-bold text-primary">
          {overview.headshotPercentage.toFixed(1)}%
        </div>
        <div className="text-sm text-text-secondary">All time</div>
      </div>

      {/* Recent Performance Card */}
      <div className="bg-background-primary rounded-lg p-4 md:col-span-2">
        <PerformanceChart
          data={performanceData}
          title="Recent Performance"
          height={240}
        />
      </div>
    </div>
  );
}; 