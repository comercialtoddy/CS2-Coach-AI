import React from 'react';
import { useTeams } from '../../hooks';
import { Topbar } from '../MainPanel/Topbar';

/**
 * Teams Page
 * 
 * Displays a list of teams with their members and basic information.
 * Allows users to view and manage teams.
 */
export const TeamsPage: React.FC = () => {
  const { teams, filteredTeams, isLoading } = useTeams();
  const [layout, setLayout] = React.useState<'card' | 'table'>('card');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Carregando times...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <Topbar
        header="Times"
        buttonText="Criar Time"
        layout={layout}
        setLayout={setLayout}
      />
      
      <div className="flex-1 overflow-y-auto">
        {layout === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="bg-background-secondary rounded-lg p-4 border border-border hover:bg-background-primary transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{team.name}</h3>
                    <p className="text-text-secondary text-sm">
                      {team.players?.length || 0} jogadores
                    </p>
                  </div>
                </div>
                
                {/* Team Members */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-text-secondary">Membros:</h4>
                  {team.players && team.players.length > 0 ? (
                    <div className="space-y-1">
                      {team.players.slice(0, 3).map((player) => (
                        <div key={player.id} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-primary text-xs font-medium">
                              {player.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-text">{player.username}</span>
                        </div>
                      ))}
                      {team.players.length > 3 && (
                        <p className="text-xs text-text-secondary ml-8">
                          +{team.players.length - 3} mais
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">Nenhum membro</p>
                  )}
                </div>
                
                {/* Team Stats */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-text-secondary">Partidas</p>
                      <p className="font-medium text-text">0</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Win Rate</p>
                      <p className="font-medium text-text">0%</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-background-secondary rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-background-primary">
                <tr>
                  <th className="text-left p-4 font-semibold">Time</th>
                  <th className="text-left p-4 font-semibold">Membros</th>
                  <th className="text-left p-4 font-semibold">Partidas</th>
                  <th className="text-left p-4 font-semibold">Win Rate</th>
                  <th className="text-left p-4 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <tr key={team.id} className="border-t border-border hover:bg-background-primary/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">
                            {team.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{team.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-text-secondary">
                      {team.players?.length || 0} jogadores
                    </td>
                    <td className="p-4 text-text-secondary">0</td>
                    <td className="p-4 text-text-secondary">0%</td>
                    <td className="p-4">
                      <button className="text-primary hover:text-primary-dark transition-colors">
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredTeams.length === 0 && (
          <div className="text-center py-8">
            <p className="text-text-secondary">Nenhum time encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};