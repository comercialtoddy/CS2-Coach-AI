import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MdSearch, 
  MdFilterList, 
  MdSort, 
  MdRefresh,
  MdPerson,
  MdStar,
  MdStarBorder,
  MdTrendingUp,
  MdTrendingDown,
  MdAdd,
  MdEdit
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { usePlayers } from '../../hooks';

interface Player {
  id: string;
  name: string;
  steamId: string;
  avatar?: string;
  rank: string;
  level: number;
  stats: {
    kills: number;
    deaths: number;
    assists: number;
    headshots: number;
    rating: number;
    kdr: number;
    adr: number;
    matches: number;
    wins: number;
    winRate: number;
  };
  recentForm: ('win' | 'loss' | 'tie')[];
  favorite: boolean;
  lastSeen: string;
  status: 'online' | 'offline' | 'in-game';
}

const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'ProPlayer123',
    steamId: '76561198123456789',
    avatar: 'https://avatars.steamstatic.com/default_avatar.jpg',
    rank: 'Global Elite',
    level: 40,
    stats: {
      kills: 2450,
      deaths: 1890,
      assists: 680,
      headshots: 1225,
      rating: 1.34,
      kdr: 1.30,
      adr: 85.2,
      matches: 156,
      wins: 98,
      winRate: 62.8
    },
    recentForm: ['win', 'win', 'loss', 'win', 'win'],
    favorite: true,
    lastSeen: '2024-01-15T14:30:00Z',
    status: 'online'
  },
  {
    id: '2',
    name: 'SkillfulGamer',
    steamId: '76561198987654321',
    rank: 'Supreme Master First Class',
    level: 35,
    stats: {
      kills: 1890,
      deaths: 1650,
      assists: 520,
      headshots: 945,
      rating: 1.18,
      kdr: 1.15,
      adr: 78.5,
      matches: 124,
      wins: 72,
      winRate: 58.1
    },
    recentForm: ['loss', 'win', 'win', 'loss', 'tie'],
    favorite: false,
    lastSeen: '2024-01-15T12:00:00Z',
    status: 'in-game'
  },
  {
    id: '3',
    name: 'CasualPlayer',
    steamId: '76561198456789123',
    rank: 'Legendary Eagle Master',
    level: 28,
    stats: {
      kills: 1234,
      deaths: 1456,
      assists: 345,
      headshots: 617,
      rating: 0.95,
      kdr: 0.85,
      adr: 65.8,
      matches: 89,
      wins: 42,
      winRate: 47.2
    },
    recentForm: ['loss', 'loss', 'win', 'loss', 'win'],
    favorite: false,
    lastSeen: '2024-01-14T20:15:00Z',
    status: 'offline'
  }
];

export const PlayersPage: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>(mockPlayers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'kdr' | 'winRate' | 'lastSeen'>('rating');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { players: hookPlayers, loading, refreshPlayers } = usePlayers();

  useEffect(() => {
    if (hookPlayers && hookPlayers.length > 0) {
      setPlayers(hookPlayers);
      setFilteredPlayers(hookPlayers);
    }
  }, [hookPlayers]);

  useEffect(() => {
    let filtered = players;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(player => 
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.steamId.includes(searchTerm)
      );
    }

    // Filter by rank
    if (filterRank !== 'all') {
      filtered = filtered.filter(player => player.rank === filterRank);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(player => player.status === filterStatus);
    }

    // Sort players
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return b.stats.rating - a.stats.rating;
        case 'kdr':
          return b.stats.kdr - a.stats.kdr;
        case 'winRate':
          return b.stats.winRate - a.stats.winRate;
        case 'lastSeen':
          return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        default:
          return 0;
      }
    });

    setFilteredPlayers(filtered);
  }, [players, searchTerm, filterRank, filterStatus, sortBy]);

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Agora mesmo';
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'in-game': return 'text-blue-400';
      case 'offline': return 'text-gray-400';
      default: return 'text-text-secondary';
    }
  };

  const getStatusDot = (status: string) => {
    const baseClasses = 'w-3 h-3 rounded-full';
    switch (status) {
      case 'online': return `${baseClasses} bg-green-400`;
      case 'in-game': return `${baseClasses} bg-blue-400 animate-pulse`;
      case 'offline': return `${baseClasses} bg-gray-400`;
      default: return `${baseClasses} bg-gray-400`;
    }
  };

  const toggleFavorite = (playerId: string) => {
    setPlayers(prev => prev.map(player => 
      player.id === playerId 
        ? { ...player, favorite: !player.favorite }
        : player
    ));
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      if (refreshPlayers) {
        await refreshPlayers();
      }
    } catch (error) {
      console.error('Error refreshing players:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderRecentForm = (form: ('win' | 'loss' | 'tie')[]) => {
    return (
      <div className="flex gap-1">
        {form.map((result, index) => {
          const color = result === 'win' ? 'bg-green-400' : result === 'loss' ? 'bg-red-400' : 'bg-yellow-400';
          return (
            <div key={index} className={`w-2 h-6 rounded-sm ${color}`} title={result} />
          );
        })}
      </div>
    );
  };

  const ranks = [...new Set(players.map(p => p.rank))];

  const stats = {
    totalPlayers: players.length,
    onlinePlayers: players.filter(p => p.status === 'online').length,
    inGamePlayers: players.filter(p => p.status === 'in-game').length,
    avgRating: players.length > 0 ? (players.reduce((sum, p) => sum + p.stats.rating, 0) / players.length).toFixed(2) : '0.00'
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
            <MdPerson className="text-primary" />
            Jogadores
          </h1>
          <p className="text-text-secondary mt-1">Gerencie e analise jogadores</p>
        </div>
        
        <div className="flex gap-3">
          <HUDButton
            variant="secondary"
            onClick={handleRefresh}
            loading={isLoading || loading}
            icon={<MdRefresh />}
          >
            Atualizar
          </HUDButton>
          <HUDButton
            variant="primary"
            onClick={() => navigate('/players/add')}
            icon={<MdAdd />}
          >
            Adicionar Jogador
          </HUDButton>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <HUDCard title="Total" glowColor="blue" className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.totalPlayers}</div>
          <div className="text-sm text-text-secondary">Jogadores</div>
        </HUDCard>
        
        <HUDCard title="Online" glowColor="green" className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.onlinePlayers}</div>
          <div className="text-sm text-text-secondary">Online</div>
        </HUDCard>
        
        <HUDCard title="Em Jogo" glowColor="blue" className="text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.inGamePlayers}</div>
          <div className="text-sm text-text-secondary">In Game</div>
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
            placeholder="Buscar por nome ou Steam ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg text-text placeholder-text-secondary focus:border-primary focus:outline-none"
          />
        </div>
        
        {/* Rank Filter */}
        <div className="flex items-center gap-2">
          <MdFilterList className="text-text-secondary" />
          <select
            value={filterRank}
            onChange={(e) => setFilterRank(e.target.value)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Ranks</option>
            {ranks.map(rank => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
        </div>
        
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="online">Online</option>
            <option value="in-game">Em Jogo</option>
            <option value="offline">Offline</option>
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
            <option value="rating">Rating</option>
            <option value="name">Nome</option>
            <option value="kdr">K/D Ratio</option>
            <option value="winRate">Taxa de Vitória</option>
            <option value="lastSeen">Última Vez Visto</option>
          </select>
        </div>
      </motion.div>

      {/* Players List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-hidden"
      >
        {filteredPlayers.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl text-text-secondary mb-4">👥</div>
              <h3 className="text-xl font-semibold text-text mb-2">Nenhum jogador encontrado</h3>
              <p className="text-text-secondary">
                {searchTerm || filterRank !== 'all' || filterStatus !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Adicione jogadores para começar a analisar'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto h-full pr-2">
            {filteredPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/players/${player.id}`)}
                className="group cursor-pointer"
              >
                <HUDCard 
                  glowColor={player.status === 'online' ? 'green' : player.status === 'in-game' ? 'blue' : 'gray'}
                  className="hover:scale-[1.02] transition-transform duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        <div className="w-16 h-16 rounded-lg bg-background-secondary flex items-center justify-center overflow-hidden">
                          {player.avatar ? (
                            <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <MdPerson className="text-2xl text-text-secondary" />
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 ${getStatusDot(player.status)}`} />
                      </div>
                      
                      {/* Player Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-text">{player.name}</h3>
                          {player.favorite && <MdStar className="text-yellow-400" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-text-secondary">{player.rank}</span>
                          <span className="text-sm text-text-secondary">•</span>
                          <span className="text-sm text-text-secondary">Nível {player.level}</span>
                          <span className="text-sm text-text-secondary">•</span>
                          <span className={`text-sm ${getStatusColor(player.status)}`}>
                            {player.status === 'online' ? 'Online' : 
                             player.status === 'in-game' ? 'Em Jogo' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          Visto {formatLastSeen(player.lastSeen)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{player.stats.rating}</div>
                        <div className="text-xs text-text-secondary">Rating</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{player.stats.kdr}</div>
                        <div className="text-xs text-text-secondary">K/D</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{player.stats.winRate.toFixed(1)}%</div>
                        <div className="text-xs text-text-secondary">Win Rate</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{player.stats.adr}</div>
                        <div className="text-xs text-text-secondary">ADR</div>
                      </div>
                      
                      {/* Recent Form */}
                      <div className="text-center">
                        {renderRecentForm(player.recentForm)}
                        <div className="text-xs text-text-secondary mt-1">Forma</div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(player.id);
                          }}
                          className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
                        >
                          {player.favorite ? (
                            <MdStar className="text-yellow-400" />
                          ) : (
                            <MdStarBorder className="text-text-secondary group-hover:text-yellow-400 transition-colors" />
                          )}
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/players/${player.id}/edit`);
                          }}
                          className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
                        >
                          <MdEdit className="text-text-secondary group-hover:text-primary transition-colors" />
                        </button>
                      </div>
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