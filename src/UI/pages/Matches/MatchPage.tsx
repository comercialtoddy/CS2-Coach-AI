import React from 'react';
import { Link } from 'react-router-dom';
import { Topbar } from '../MainPanel/Topbar';

/**
 * Matches List Page
 * 
 * Displays a paginated list of match history.
 * Each match shows summary information and links to detailed analysis.
 */
export const MatchesPage: React.FC = () => {
  const [layout, setLayout] = React.useState<'card' | 'table'>('card');
  const [isLoading] = React.useState(false);

  // Mock data - replace with actual API call
  const matches = [
    {
      id: '1',
      map: 'de_dust2',
      date: '2024-01-15T14:30:00Z',
      result: 'win' as const,
      score: { team: 16, enemy: 12 },
      kills: 18,
      deaths: 14,
      assists: 5
    },
    {
      id: '2',
      map: 'de_mirage',
      date: '2024-01-14T20:15:00Z',
      result: 'loss' as const,
      score: { team: 13, enemy: 16 },
      kills: 15,
      deaths: 18,
      assists: 7
    },
    {
      id: '3',
      map: 'de_inferno',
      date: '2024-01-14T18:45:00Z',
      result: 'win' as const,
      score: { team: 16, enemy:8 },
      kills: 22,
      deaths: 10,
      assists: 4
    },
    {
      id: '4',
      map: 'de_cache',
      date: '2024-01-13T16:20:00Z',
      result: 'win' as const,
      score: { team: 16, enemy: 14 },
      kills: 19,
      deaths: 16,
      assists: 6
    },
    {
      id: '5',
      map: 'de_overpass',
      date: '2024-01-12T21:10:00Z',
      result: 'loss' as const,
      score: { team: 11, enemy: 16 },
      kills: 12,
      deaths: 19,
      assists: 3
    }
  ];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando partidas...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <Topbar
        header="Histórico de Partidas"
        layout={layout}
        setLayout={setLayout}
      />
      
      <div className="flex-1 overflow-y-auto">
        {layout === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match) => (
              <Link
                key={match.id}
                to={`/matches/${match.id}`}
                className="bg-background-secondary rounded-lg p-4 hover:bg-background-primary transition-colors border border-border"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-text">{match.map}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    match.result === 'win' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {match.result === 'win' ? 'Vitória' : 'Derrota'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Placar:</span>
                    <span className="text-text font-medium">
                      {match.score.team} - {match.score.enemy}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">K/D/A:</span>
                    <span className="text-text font-medium">
                      {match.kills}/{match.deaths}/{match.assists}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Data:</span>
                    <span className="text-text-secondary text-xs">
                      {formatDate(match.date)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-background-secondary rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-background-primary">
                <tr>
                  <th className="text-left p-4 font-semibold">Mapa</th>
                  <th className="text-left p-4 font-semibold">Resultado</th>
                  <th className="text-left p-4 font-semibold">Placar</th>
                  <th className="text-left p-4 font-semibold">K/D/A</th>
                  <th className="text-left p-4 font-semibold">Data</th>
                  <th className="text-left p-4 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id} className="border-t border-border hover:bg-background-primary/50">
                    <td className="p-4 font-medium">{match.map}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        match.result === 'win' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {match.result === 'win' ? 'Vitória' : 'Derrota'}
                      </span>
                    </td>
                    <td className="p-4 text-text-secondary">
                      {match.score.team} - {match.score.enemy}
                    </td>
                    <td className="p-4 text-text-secondary">
                      {match.kills}/{match.deaths}/{match.assists}
                    </td>
                    <td className="p-4 text-text-secondary text-sm">
                      {formatDate(match.date)}
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/matches/${match.id}`}
                        className="text-primary hover:text-primary-dark transition-colors"
                      >
                        Ver Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {matches.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-secondary">Nenhuma partida encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
};