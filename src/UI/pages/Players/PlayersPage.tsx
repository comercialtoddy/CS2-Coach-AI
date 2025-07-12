import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayers } from '../../hooks';
import { Searchbar } from '../../components';
import { Topbar } from '../MainPanel/Topbar';

/**
 * Players List Page
 * 
 * Displays a list of all tracked players with search functionality.
 * Each player in the list is a link to their detailed profile page.
 */
export const PlayersPage: React.FC = () => {
  const { players, filteredPlayers, searchPlayers, isLoading } = usePlayers();
  const [layout, setLayout] = React.useState<'card' | 'table'>('card');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando jogadores...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <Topbar
        header="Jogadores"
        buttonText="Adicionar Jogador"
        layout={layout}
        setLayout={setLayout}
      />
      
      <div className="flex-1 overflow-y-auto">
        {layout === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map((player) => (
              <Link
                key={player.id}
                to={`/players/${player.id}`}
                className="bg-background-secondary rounded-lg p-4 hover:bg-background-primary transition-colors border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{player.username}</h3>
                    <p className="text-text-secondary text-sm">
                      Steam ID: {player.steamId}
                    </p>
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
                  <th className="text-left p-4 font-semibold">Jogador</th>
                  <th className="text-left p-4 font-semibold">Steam ID</th>
                  <th className="text-left p-4 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="border-t border-border hover:bg-background-primary/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">
                            {player.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{player.username}</span>
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary">{player.steamId}</td>
                    <td className="p-4">
                      <Link
                        to={`/players/${player.id}`}
                        className="text-primary hover:text-primary-dark transition-colors"
                      >
                        Ver Perfil
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredPlayers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-secondary">Nenhum jogador encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};