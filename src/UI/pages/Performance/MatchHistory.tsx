import React, { useEffect } from 'react';
import { usePerformance } from '../../hooks';

interface MatchResult {
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

/**
 * Match History Section
 * 
 * Displays a list of recent matches with:
 * - Match result
 * - Map played
 * - Score
 * - Individual performance
 * - Detailed stats
 */
export const MatchHistory: React.FC = () => {
  const {
    matches,
    totalMatches,
    hasMoreMatches,
    isLoadingMatches,
    matchesError,
    loadMatches
  } = usePerformance();

  // Load initial matches
  useEffect(() => {
    loadMatches(1);
  }, [loadMatches]);

  if (isLoadingMatches && matches.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filters Skeleton */}
        <div className="flex gap-4 items-center">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="w-32 h-10 bg-background-primary rounded-lg animate-pulse"
            />
          ))}
        </div>

        {/* Match List Skeleton */}
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-background-primary rounded-lg p-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-8 bg-background-secondary rounded" />
                  <div>
                    <div className="w-24 h-6 bg-background-secondary rounded mb-1" />
                    <div className="w-32 h-4 bg-background-secondary rounded" />
                  </div>
                </div>
                <div className="w-20 h-8 bg-background-secondary rounded" />
                <div className="flex gap-6">
                  {[...Array(3)].map((_, j) => (
                    <div key={j}>
                      <div className="w-12 h-4 bg-background-secondary rounded mb-1" />
                      <div className="w-16 h-6 bg-background-secondary rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (matchesError) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Matches</h3>
        <p className="mb-4">{matchesError.message}</p>
        <button
          onClick={() => loadMatches(1)}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          className="bg-background-primary text-text px-4 py-2 rounded-lg"
          onChange={e => loadMatches(1, { map: e.target.value })}
        >
          <option value="">All Maps</option>
          <option value="mirage">Mirage</option>
          <option value="inferno">Inferno</option>
          <option value="ancient">Ancient</option>
        </select>

        <select
          className="bg-background-primary text-text px-4 py-2 rounded-lg"
          onChange={e => loadMatches(1, { result: e.target.value as 'win' | 'loss' })}
        >
          <option value="">All Results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
        </select>
      </div>

      {/* Match List */}
      <div className="space-y-2">
        {matches.map(match => (
          <div
            key={match.id}
            className="bg-background-primary rounded-lg p-4 hover:bg-background-secondary transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              {/* Match Info */}
              <div className="flex items-center gap-4">
                <div
                  className={`text-sm font-medium px-2 py-1 rounded ${
                    match.result === 'win'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                  }`}
                >
                  {match.result.toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{match.map}</div>
                  <div className="text-sm text-text-secondary">{match.date}</div>
                </div>
              </div>

              {/* Score */}
              <div className="text-xl font-bold">
                {match.score.team} - {match.score.opponent}
              </div>

              {/* Performance */}
              <div className="flex gap-6">
                <div>
                  <div className="text-sm text-text-secondary">K/D/A</div>
                  <div className="font-medium">
                    {match.performance.kills}/{match.performance.deaths}/
                    {match.performance.assists}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-text-secondary">ADR</div>
                  <div className="font-medium">{match.performance.adr}</div>
                </div>
                <div>
                  <div className="text-sm text-text-secondary">HS%</div>
                  <div className="font-medium">{match.performance.hs}%</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMoreMatches && (
        <div className="flex justify-center">
          <button
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={() => loadMatches(Math.ceil(matches.length / 10) + 1)}
            disabled={isLoadingMatches}
          >
            {isLoadingMatches ? 'Loading...' : 'Load More Matches'}
          </button>
        </div>
      )}
    </div>
  );
}; 