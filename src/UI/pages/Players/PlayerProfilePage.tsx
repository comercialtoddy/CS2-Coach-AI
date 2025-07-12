import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePlayers } from '../../hooks';

/**
 * Player Profile Page
 * 
 * Displays detailed information about a specific player including:
 * - Player statistics (K/D, win rate)
 * - Match history
 * - Weapon analysis
 * - Map performance
 */
export const PlayerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { players, isLoading } = usePlayers();
  
  const player = players.find(p => p.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando perfil do jogador...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <h2 className="text-2xl font-bold text-text">Jogador não encontrado</h2>
        <p className="text-text-secondary">O jogador com ID {id} não foi encontrado.</p>
        <Link 
          to="/players" 
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          Voltar para Lista de Jogadores
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/players" 
          className="text-primary hover:text-primary-dark transition-colors"
        >
          ← Voltar
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-primary font-bold text-2xl">
              {player.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-text">{player.username}</h1>
            <p className="text-text-secondary">Steam ID: {player.steamId}</p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">K/D Ratio</h3>
          <p className="text-2xl font-bold text-text">1.25</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Win Rate</h3>
          <p className="text-2xl font-bold text-text">68%</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Partidas Jogadas</h3>
          <p className="text-2xl font-bold text-text">142</p>
        </div>
        <div className="bg-background-secondary rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">ADR</h3>
          <p className="text-2xl font-bold text-text">78.5</p>
        </div>
      </div>

      {/* Content Sections */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <div className="bg-background-secondary rounded-lg p-4">
          <h2 className="text-xl font-bold text-text mb-4">Partidas Recentes</h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((match) => (
              <div key={match} className="flex items-center justify-between p-3 bg-background-primary rounded-lg">
                <div>
                  <p className="font-medium text-text">de_dust2</p>
                  <p className="text-sm text-text-secondary">16-12 Vitória</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-secondary">K/D: 18/14</p>
                  <p className="text-xs text-text-secondary">2 horas atrás</p>
                </div>
              </div>
            ))}
          </div>
          <Link 
            to={`/matches?player=${id}`}
            className="block text-center mt-4 text-primary hover:text-primary-dark transition-colors"
          >
            Ver Todas as Partidas
          </Link>
        </div>

        {/* Map Performance */}
        <div className="bg-background-secondary rounded-lg p-4">
          <h2 className="text-xl font-bold text-text mb-4">Performance por Mapa</h2>
          <div className="space-y-3">
            {[
              { map: 'de_dust2', winRate: 72, matches: 25 },
              { map: 'de_mirage', winRate: 65, matches: 20 },
              { map: 'de_inferno', winRate: 58, matches: 18 },
              { map: 'de_cache', winRate: 80, matches: 15 },
            ].map((mapData) => (
              <div key={mapData.map} className="flex items-center justify-between p-3 bg-background-primary rounded-lg">
                <div>
                  <p className="font-medium text-text">{mapData.map}</p>
                  <p className="text-sm text-text-secondary">{mapData.matches} partidas</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-text">{mapData.winRate}%</p>
                  <p className="text-xs text-text-secondary">Win Rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};