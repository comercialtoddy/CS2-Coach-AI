import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MdSearch, 
  MdFilterList, 
  MdSort, 
  MdRefresh,
  MdTrendingUp,
  MdTrendingDown,
  MdRemove,
  MdStar,
  MdStarBorder,
  MdPlayArrow
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { useMatches } from '../../hooks';

interface Match {
  id: string;
  date: string;
  map: string;
  gameMode: string;
  result: 'win' | 'loss' | 'tie';
  score: {
    team: number;
    enemy: number;
  };
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  rating: number;
  favorite: boolean;
}

const mockMatches: Match[] = [
  {
    id: '1',
    date: '2024-01-15T14:30:00Z',
    map: 'de_dust2',
    gameMode: 'Competitive',
    result: 'win',
    score: { team: 16, enemy: 12 },
    duration: 2340,
    kills: 24,
    deaths: 18,
    assists: 6,
    mvps: 3,
    rating: 1.24,
    favorite: true
  },
  {
    id: '2',
    date: '2024-01-15T12:00:00Z',
    map: 'de_mirage',
    gameMode: 'Competitive',
    result: 'loss',
    score: { team: 13, enemy: 16 },
    duration: 2580,
    kills: 19,
    deaths: 22,
    assists: 4,
    mvps: 1,
    rating: 0.89,
    favorite: false
  },
  {
    id: '3',
    date: '2024-01-14T20:15:00Z',
    map: 'de_inferno',
    gameMode: 'Competitive',
    result: 'win',
    score: { team: 16, enemy: 8 },
    duration: 1980,
    kills: 28,
    deaths: 12,
    assists: 8,
    mvps: 5,
    rating: 1.67,
    favorite: false
  }
];

export const MatchesPage: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>(mockMatches);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>(mockMatches);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss' | 'tie'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'kills'>('date');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { matches: hookMatches, isLoading: hookLoading } = useMatches();

  useEffect(() => {
    if (hookMatches && hookMatches.length > 0) {
      setMatches(hookMatches);
      setFilteredMatches(hookMatches);
    }
  }, [hookMatches]);

  useEffect(() => {
    let filtered = matches;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(match => 
        match.map.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.gameMode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by result
    if (filterResult !== 'all') {
      filtered = filtered.filter(match => match.result === filterResult);
    }

    // Sort matches
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'rating':
          return b.rating - a.rating;
        case 'kills':
          return b.kills - a.kills;
        default:
          return 0;
      }
    });

    setFilteredMatches(filtered);
  }, [matches, searchTerm, filterResult, sortBy]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'tie': return 'text-yellow-400';
      default: return 'text-text-secondary';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win': return <MdTrendingUp className="text-green-400" />;
      case 'loss': return <MdTrendingDown className="text-red-400" />;
      case 'tie': return <MdRemove className="text-yellow-400" />;
      default: return null;
    }
  };

  const toggleFavorite = (matchId: string) => {
    setMatches(prev => prev.map(match => 
      match.id === matchId 
        ? { ...match, favorite: !match.favorite }
        : match
    ));
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Refresh logic can be implemented here
      console.log('Refreshing matches...');
    } catch (error) {
      console.error('Error refreshing matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    totalMatches: matches.length,
    wins: matches.filter(m => m.result === 'win').length,
    losses: matches.filter(m => m.result === 'loss').length,
    winRate: matches.length > 0 ? (matches.filter(m => m.result === 'win').length / matches.length * 100).toFixed(1) : '0',
    avgRating: matches.length > 0 ? (matches.reduce((sum, m) => sum + m.rating, 0) / matches.length).toFixed(2) : '0.00'
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-text flex items-center gap-3">
            <MdPlayArrow className="text-primary" />
            Histórico de Partidas
          </h1>
          <p className="text-text-secondary mt-1">Analise seu desempenho e evolução</p>
        </div>
        
        <HUDButton
          variant="primary"
          onClick={handleRefresh}
          loading={isLoading || hookLoading}
          icon={<MdRefresh />}
        >
          Atualizar
        </HUDButton>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <HUDCard title="Total" glowColor="blue" className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.totalMatches}</div>
          <div className="text-sm text-text-secondary">Partidas</div>
        </HUDCard>
        
        <HUDCard title="Vitórias" glowColor="green" className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
          <div className="text-sm text-text-secondary">Wins</div>
        </HUDCard>
        
        <HUDCard title="Derrotas" glowColor="red" className="text-center">
          <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
          <div className="text-sm text-text-secondary">Losses</div>
        </HUDCard>
        
        <HUDCard title="Taxa de Vitória" glowColor="orange" className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.winRate}%</div>
          <div className="text-sm text-text-secondary">Win Rate</div>
        </HUDCard>
        
        <HUDCard title="Rating Médio" glowColor="purple" className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.avgRating}</div>
          <div className="text-sm text-text-secondary">Avg Rating</div>
        </HUDCard>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-4 items-center"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Buscar por mapa ou modo de jogo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg text-text placeholder-text-secondary focus:border-primary focus:outline-none"
          />
        </div>
        
        {/* Result Filter */}
        <div className="flex items-center gap-2">
          <MdFilterList className="text-text-secondary" />
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as any)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Resultados</option>
            <option value="win">Vitórias</option>
            <option value="loss">Derrotas</option>
            <option value="tie">Empates</option>
          </select>
        </div>
        
        {/* Sort */}
        <div className="flex items-center gap-2">
          <MdSort className="text-text-secondary" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="date">Data</option>
            <option value="rating">Rating</option>
            <option value="kills">Kills</option>
          </select>
        </div>
      </motion.div>

      {/* Matches List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-hidden"
      >
        {filteredMatches.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl text-text-secondary mb-4">🎮</div>
              <h3 className="text-xl font-semibold text-text mb-2">Nenhuma partida encontrada</h3>
              <p className="text-text-secondary">
                {searchTerm || filterResult !== 'all' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Suas partidas aparecerão aqui quando você jogar'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto h-full pr-2">
            {filteredMatches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/matches/${match.id}`)}
                className="group cursor-pointer"
              >
                <HUDCard 
                  glowColor={match.result === 'win' ? 'green' : match.result === 'loss' ? 'red' : 'orange'}
                  className="hover:scale-[1.02] transition-transform duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Result Icon */}
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-background-secondary">
                        {getResultIcon(match.result)}
                      </div>
                      
                      {/* Match Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-text">{match.map}</h3>
                          <span className="text-sm text-text-secondary">•</span>
                          <span className="text-sm text-text-secondary">{match.gameMode}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className={`font-medium ${getResultColor(match.result)}`}>
                            {match.score.team} - {match.score.enemy}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {formatDate(match.date)}
                          </span>
                          <span className="text-sm text-text-secondary">
                            {formatDuration(match.duration)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{match.kills}/{match.deaths}/{match.assists}</div>
                        <div className="text-xs text-text-secondary">K/D/A</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{match.rating}</div>
                        <div className="text-xs text-text-secondary">Rating</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{match.mvps}</div>
                        <div className="text-xs text-text-secondary">MVPs</div>
                      </div>
                      
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(match.id);
                        }}
                        className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
                      >
                        {match.favorite ? (
                          <MdStar className="text-yellow-400" />
                        ) : (
                          <MdStarBorder className="text-text-secondary group-hover:text-yellow-400 transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>
                </HUDCard>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};