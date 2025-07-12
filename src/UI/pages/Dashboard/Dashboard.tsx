import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Dashboard Page
 * 
 * Main dashboard displaying:
 * - Performance overview with key statistics
 * - Recent matches summary
 * - Quick navigation to other sections
 * - Performance trends and insights
 */
export const Dashboard: React.FC = () => {
  const [isLoading] = React.useState(false);

  // Mock data - replace with actual API calls
  const stats = {
    kdRatio: 1.25,
    winRate: 68,
    totalMatches: 142,
    adr: 78.5,
    headshots: 45.2,
    mvps: 23
  };

  const recentMatches = [
    {
      id: '1',
      map: 'de_dust2',
      result: 'win' as const,
      score: '16-12',
      kda: '18/14/5',
      date: '2 horas atrás'
    },
    {
      id: '2',
      map: 'de_mirage',
      result: 'loss' as const,
      score: '13-16',
      kda: '15/18/7',
      date: '1 dia atrás'
    },
    {
      id: '3',
      map: 'de_inferno',
      result: 'win' as const,
      score: '16-8',
      kda: '22/10/4',
      date: '1 dia atrás'
    },
    {
      id: '4',
      map: 'de_cache',
      result: 'win' as const,
      score: '16-14',
      kda: '19/16/6',
      date: '2 dias atrás'
    },
    {
      id: '5',
      map: 'de_overpass',
      result: 'loss' as const,
      score: '11-16',
      kda: '12/19/3',
      date: '3 dias atrás'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text">Dashboard</h1>
        <div className="text-text-secondary">
          Última atualização: agora
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">K/D Ratio</h3>
          <p className="text-2xl font-bold text-text">{stats.kdRatio}</p>
          <p className="text-xs text-green-400 mt-1">+0.15 esta semana</p>
        </div>
        
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Win Rate</h3>
          <p className="text-2xl font-bold text-text">{stats.winRate}%</p>
          <p className="text-xs text-green-400 mt-1">+5% esta semana</p>
        </div>
        
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Partidas</h3>
          <p className="text-2xl font-bold text-text">{stats.totalMatches}</p>
          <p className="text-xs text-text-secondary mt-1">Total jogadas</p>
        </div>
        
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">ADR</h3>
          <p className="text-2xl font-bold text-text">{stats.adr}</p>
          <p className="text-xs text-green-400 mt-1">+3.2 esta semana</p>
        </div>
        
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">HS%</h3>
          <p className="text-2xl font-bold text-text">{stats.headshots}%</p>
          <p className="text-xs text-red-400 mt-1">-1.8% esta semana</p>
        </div>
        
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">MVPs</h3>
          <p className="text-2xl font-bold text-text">{stats.mvps}</p>
          <p className="text-xs text-text-secondary mt-1">Este mês</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <div className="lg:col-span-2 bg-background-secondary rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text">Partidas Recentes</h2>
            <Link 
              to="/matches" 
              className="text-primary hover:text-primary-dark transition-colors text-sm"
            >
              Ver Todas
            </Link>
          </div>
          
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <Link
                key={match.id}
                to={`/matches/${match.id}`}
                className="flex items-center justify-between p-3 bg-background-primary rounded-lg hover:bg-background-primary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${
                    match.result === 'win' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <p className="font-medium text-text">{match.map}</p>
                    <p className="text-sm text-text-secondary">{match.date}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-medium text-text">{match.score}</p>
                  <p className="text-sm text-text-secondary">{match.kda}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          {/* Performance Analysis */}
          <div className="bg-background-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold text-text mb-3">Análise de Performance</h3>
            <div className="space-y-3">
              <Link 
                to="/performance" 
                className="block p-3 bg-background-primary rounded-lg hover:bg-background-primary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-primary text-sm">📊</span>
                  </div>
                  <div>
                    <p className="font-medium text-text">Dashboard Completo</p>
                    <p className="text-xs text-text-secondary">Análise detalhada</p>
                  </div>
                </div>
              </Link>
              
              <Link 
                to="/performance/maps" 
                className="block p-3 bg-background-primary rounded-lg hover:bg-background-primary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-primary text-sm">🗺️</span>
                  </div>
                  <div>
                    <p className="font-medium text-text">Análise de Mapas</p>
                    <p className="text-xs text-text-secondary">Performance por mapa</p>
                  </div>
                </div>
              </Link>
              
              <Link 
                to="/performance/weapons" 
                className="block p-3 bg-background-primary rounded-lg hover:bg-background-primary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-primary text-sm">🔫</span>
                  </div>
                  <div>
                    <p className="font-medium text-text">Análise de Armas</p>
                    <p className="text-xs text-text-secondary">Estatísticas de armas</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-background-secondary rounded-lg p-4">
            <h3 className="text-lg font-bold text-text mb-3">Estatísticas Rápidas</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-text-secondary">Melhor mapa:</span>
                <span className="text-text font-medium">de_cache (80%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Arma favorita:</span>
                <span className="text-text font-medium">AK-47</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Streak atual:</span>
                <span className="text-green-400 font-medium">3 vitórias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Rank:</span>
                <span className="text-text font-medium">Global Elite</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};