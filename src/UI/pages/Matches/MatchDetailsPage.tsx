import React from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * Match Details Page
 * 
 * Displays detailed analysis of a specific match including:
 * - Final score
 * - Player statistics for all participants
 * - Round-by-round breakdown
 * - Key events and highlights
 */
export const MatchDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isLoading] = React.useState(false);

  // Mock data - replace with actual API call
  const matchData = {
    id: id,
    map: 'de_dust2',
    date: '2024-01-15T14:30:00Z',
    result: 'win' as const,
    score: { team: 16, enemy: 12 },
    duration: '42:35',
    players: [
      {
        id: '1',
        name: 'Player1',
        team: 'team',
        kills: 18,
        deaths: 14,
        assists: 5,
        adr: 78.5,
        rating: 1.25
      },
      {
        id: '2',
        name: 'Player2',
        team: 'team',
        kills: 15,
        deaths: 16,
        assists: 8,
        adr: 65.2,
        rating: 1.02
      },
      {
        id: '3',
        name: 'Player3',
        team: 'team',
        kills: 22,
        deaths: 12,
        assists: 3,
        adr: 85.1,
        rating: 1.45
      },
      {
        id: '4',
        name: 'Player4',
        team: 'team',
        kills: 12,
        deaths: 18,
        assists: 9,
        adr: 58.7,
        rating: 0.89
      },
      {
        id: '5',
        name: 'Player5',
        team: 'team',
        kills: 19,
        deaths: 15,
        assists: 6,
        adr: 72.3,
        rating: 1.18
      },
      // Enemy team
      {
        id: '6',
        name: 'Enemy1',
        team: 'enemy',
        kills: 16,
        deaths: 17,
        assists: 4,
        adr: 68.9,
        rating: 1.08
      },
      {
        id: '7',
        name: 'Enemy2',
        team: 'enemy',
        kills: 14,
        deaths: 18,
        assists: 7,
        adr: 62.1,
        rating: 0.95
      },
      {
        id: '8',
        name: 'Enemy3',
        team: 'enemy',
        kills: 20,
        deaths: 16,
        assists: 5,
        adr: 79.4,
        rating: 1.32
      },
      {
        id: '9',
        name: 'Enemy4',
        team: 'enemy',
        kills: 11,
        deaths: 19,
        assists: 8,
        adr: 55.6,
        rating: 0.82
      },
      {
        id: '10',
        name: 'Enemy5',
        team: 'enemy',
        kills: 17,
        deaths: 16,
        assists: 6,
        adr: 71.2,
        rating: 1.15
      }
    ]
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const teamPlayers = matchData.players.filter(p => p.team === 'team');
  const enemyPlayers = matchData.players.filter(p => p.team === 'enemy');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando detalhes da partida...</div>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <h2 className="text-2xl font-bold text-text">Partida não encontrada</h2>
        <p className="text-text-secondary">A partida com ID {id} não foi encontrada.</p>
        <Link 
          to="/matches" 
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
        >
          Voltar para Lista de Partidas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          to="/matches" 
          className="text-primary hover:text-primary-dark transition-colors"
        >
          ← Voltar
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-text">{matchData.map}</h1>
          <p className="text-text-secondary">{formatDate(matchData.date)}</p>
        </div>
      </div>

      {/* Match Summary */}
      <div className="bg-background-secondary rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Resultado</h3>
            <span className={`px-3 py-1 rounded text-lg font-bold ${
              matchData.result === 'win' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {matchData.result === 'win' ? 'Vitória' : 'Derrota'}
            </span>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Placar Final</h3>
            <p className="text-2xl font-bold text-text">
              {matchData.score.team} - {matchData.score.enemy}
            </p>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Duração</h3>
            <p className="text-2xl font-bold text-text">{matchData.duration}</p>
          </div>
          <div className="text-center">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Mapa</h3>
            <p className="text-2xl font-bold text-text">{matchData.map}</p>
          </div>
        </div>
      </div>

      {/* Player Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Our Team */}
        <div className="bg-background-secondary rounded-lg p-4">
          <h2 className="text-xl font-bold text-text mb-4 text-center">Nosso Time</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2">Jogador</th>
                  <th className="text-center p-2">K</th>
                  <th className="text-center p-2">D</th>
                  <th className="text-center p-2">A</th>
                  <th className="text-center p-2">ADR</th>
                  <th className="text-center p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {teamPlayers.map((player) => (
                  <tr key={player.id} className="border-b border-border/50">
                    <td className="p-2 font-medium">{player.name}</td>
                    <td className="p-2 text-center">{player.kills}</td>
                    <td className="p-2 text-center">{player.deaths}</td>
                    <td className="p-2 text-center">{player.assists}</td>
                    <td className="p-2 text-center">{player.adr}</td>
                    <td className="p-2 text-center">
                      <span className={`font-medium ${
                        player.rating >= 1.0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {player.rating.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enemy Team */}
        <div className="bg-background-secondary rounded-lg p-4">
          <h2 className="text-xl font-bold text-text mb-4 text-center">Time Adversário</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2">Jogador</th>
                  <th className="text-center p-2">K</th>
                  <th className="text-center p-2">D</th>
                  <th className="text-center p-2">A</th>
                  <th className="text-center p-2">ADR</th>
                  <th className="text-center p-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {enemyPlayers.map((player) => (
                  <tr key={player.id} className="border-b border-border/50">
                    <td className="p-2 font-medium">{player.name}</td>
                    <td className="p-2 text-center">{player.kills}</td>
                    <td className="p-2 text-center">{player.deaths}</td>
                    <td className="p-2 text-center">{player.assists}</td>
                    <td className="p-2 text-center">{player.adr}</td>
                    <td className="p-2 text-center">
                      <span className={`font-medium ${
                        player.rating >= 1.0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {player.rating.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};