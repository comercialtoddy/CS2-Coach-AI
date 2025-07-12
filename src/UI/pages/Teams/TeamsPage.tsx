import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MdSearch, 
  MdFilterList, 
  MdSort, 
  MdRefresh,
  MdGroup,
  MdStar,
  MdStarBorder,
  MdTrendingUp,
  MdTrendingDown,
  MdAdd,
  MdEdit,
  MdPeople,
  MdEmojiEvents
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { useTeams } from '../../hooks';

interface Team {
  id: string;
  name: string;
  tag: string;
  logo?: string;
  region: string;
  founded: string;
  players: {
    id: string;
    name: string;
    role: 'IGL' | 'AWPer' | 'Entry' | 'Support' | 'Lurker';
    rating: number;
  }[];
  stats: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    rating: number;
    roundsWon: number;
    roundsLost: number;
    avgRounds: number;
  };
  recentForm: ('win' | 'loss' | 'tie')[];
  favorite: boolean;
  lastMatch: string;
  status: 'active' | 'inactive' | 'disbanded';
  achievements: string[];
}

const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Team Liquid',
    tag: 'TL',
    logo: 'https://img-cdn.hltv.org/teamlogo/logo.png',
    region: 'North America',
    founded: '2015-01-12',
    players: [
      { id: '1', name: 'EliGE', role: 'Entry', rating: 1.15 },
      { id: '2', name: 'NAF', role: 'Support', rating: 1.12 },
      { id: '3', name: 'nitr0', role: 'IGL', rating: 1.05 },
      { id: '4', name: 'Stewie2K', role: 'Lurker', rating: 1.08 },
      { id: '5', name: 'Twistzz', role: 'AWPer', rating: 1.18 }
    ],
    stats: {
      matches: 156,
      wins: 98,
      losses: 58,
      winRate: 62.8,
      rating: 1.12,
      roundsWon: 2450,
      roundsLost: 1890,
      avgRounds: 27.8
    },
    recentForm: ['win', 'win', 'loss', 'win', 'win'],
    favorite: true,
    lastMatch: '2024-01-15T14:30:00Z',
    status: 'active',
    achievements: ['ESL Pro League S16 Winner', 'IEM Grand Slam']
  },
  {
    id: '2',
    name: 'Astralis',
    tag: 'AST',
    region: 'Europe',
    founded: '2016-01-01',
    players: [
      { id: '6', name: 'device', role: 'AWPer', rating: 1.22 },
      { id: '7', name: 'dupreeh', role: 'Entry', rating: 1.08 },
      { id: '8', name: 'Xyp9x', role: 'Support', rating: 1.02 },
      { id: '9', name: 'gla1ve', role: 'IGL', rating: 1.05 },
      { id: '10', name: 'Magisk', role: 'Lurker', rating: 1.14 }
    ],
    stats: {
      matches: 189,
      wins: 134,
      losses: 55,
      winRate: 70.9,
      rating: 1.18,
      roundsWon: 2890,
      roundsLost: 1650,
      avgRounds: 24.1
    },
    recentForm: ['win', 'loss', 'win', 'win', 'tie'],
    favorite: false,
    lastMatch: '2024-01-15T12:00:00Z',
    status: 'active',
    achievements: ['Major Champion x4', 'Intel Grand Slam']
  },
  {
    id: '3',
    name: 'FaZe Clan',
    tag: 'FaZe',
    region: 'Europe',
    founded: '2016-05-15',
    players: [
      { id: '11', name: 'karrigan', role: 'IGL', rating: 1.08 },
      { id: '12', name: 'rain', role: 'Entry', rating: 1.12 },
      { id: '13', name: 'Twistzz', role: 'Support', rating: 1.16 },
      { id: '14', name: 'ropz', role: 'Lurker', rating: 1.19 },
      { id: '15', name: 'broky', role: 'AWPer', rating: 1.14 }
    ],
    stats: {
      matches: 142,
      wins: 89,
      losses: 53,
      winRate: 62.7,
      rating: 1.14,
      roundsWon: 2234,
      roundsLost: 1756,
      avgRounds: 28.1
    },
    recentForm: ['loss', 'loss', 'win', 'loss', 'win'],
    favorite: false,
    lastMatch: '2024-01-14T20:15:00Z',
    status: 'active',
    achievements: ['PGL Major Antwerp 2022', 'IEM Katowice 2022']
  }
];

export const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>(mockTeams);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'winRate' | 'lastMatch'>('rating');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { teams: hookTeams, loading, refreshTeams } = useTeams();

  useEffect(() => {
    if (hookTeams && hookTeams.length > 0) {
      setTeams(hookTeams);
      setFilteredTeams(hookTeams);
    }
  }, [hookTeams]);

  useEffect(() => {
    let filtered = teams;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(team => 
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by region
    if (filterRegion !== 'all') {
      filtered = filtered.filter(team => team.region === filterRegion);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(team => team.status === filterStatus);
    }

    // Sort teams
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rating':
          return b.stats.rating - a.stats.rating;
        case 'winRate':
          return b.stats.winRate - a.stats.winRate;
        case 'lastMatch':
          return new Date(b.lastMatch).getTime() - new Date(a.lastMatch).getTime();
        default:
          return 0;
      }
    });

    setFilteredTeams(filtered);
  }, [teams, searchTerm, filterRegion, filterStatus, sortBy]);

  const formatLastMatch = (dateString: string) => {
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
      case 'active': return 'text-green-400';
      case 'inactive': return 'text-yellow-400';
      case 'disbanded': return 'text-red-400';
      default: return 'text-text-secondary';
    }
  };

  const getStatusDot = (status: string) => {
    const baseClasses = 'w-3 h-3 rounded-full';
    switch (status) {
      case 'active': return `${baseClasses} bg-green-400`;
      case 'inactive': return `${baseClasses} bg-yellow-400`;
      case 'disbanded': return `${baseClasses} bg-red-400`;
      default: return `${baseClasses} bg-gray-400`;
    }
  };

  const toggleFavorite = (teamId: string) => {
    setTeams(prev => prev.map(team => 
      team.id === teamId 
        ? { ...team, favorite: !team.favorite }
        : team
    ));
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      if (refreshTeams) {
        await refreshTeams();
      }
    } catch (error) {
      console.error('Error refreshing teams:', error);
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

  const regions = [...new Set(teams.map(t => t.region))];

  const stats = {
    totalTeams: teams.length,
    activeTeams: teams.filter(t => t.status === 'active').length,
    avgRating: teams.length > 0 ? (teams.reduce((sum, t) => sum + t.stats.rating, 0) / teams.length).toFixed(2) : '0.00',
    avgWinRate: teams.length > 0 ? (teams.reduce((sum, t) => sum + t.stats.winRate, 0) / teams.length).toFixed(1) : '0.0'
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
            <MdGroup className="text-primary" />
            Times
          </h1>
          <p className="text-text-secondary mt-1">Gerencie e analise times</p>
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
            onClick={() => navigate('/teams/add')}
            icon={<MdAdd />}
          >
            Adicionar Time
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
          <div className="text-2xl font-bold text-primary">{stats.totalTeams}</div>
          <div className="text-sm text-text-secondary">Times</div>
        </HUDCard>
        
        <HUDCard title="Ativos" glowColor="green" className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.activeTeams}</div>
          <div className="text-sm text-text-secondary">Ativos</div>
        </HUDCard>
        
        <HUDCard title="Rating Médio" glowColor="purple" className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.avgRating}</div>
          <div className="text-sm text-text-secondary">Avg Rating</div>
        </HUDCard>
        
        <HUDCard title="Win Rate Médio" glowColor="orange" className="text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.avgWinRate}%</div>
          <div className="text-sm text-text-secondary">Avg Win Rate</div>
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
            placeholder="Buscar por nome ou tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg text-text placeholder-text-secondary focus:border-primary focus:outline-none"
          />
        </div>
        
        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <MdFilterList className="text-text-secondary" />
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-background-secondary border border-border rounded-lg px-3 py-2 text-text focus:border-primary focus:outline-none"
          >
            <option value="all">Todas as Regiões</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
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
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="disbanded">Dissolvido</option>
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
            <option value="winRate">Taxa de Vitória</option>
            <option value="lastMatch">Última Partida</option>
          </select>
        </div>
      </motion.div>

      {/* Teams List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-hidden"
      >
        {filteredTeams.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl text-text-secondary mb-4">🏆</div>
              <h3 className="text-xl font-semibold text-text mb-2">Nenhum time encontrado</h3>
              <p className="text-text-secondary">
                {searchTerm || filterRegion !== 'all' || filterStatus !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Adicione times para começar a analisar'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto h-full pr-2">
            {filteredTeams.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/teams/${team.id}`)}
                className="group cursor-pointer"
              >
                <HUDCard 
                  glowColor={team.status === 'active' ? 'green' : team.status === 'inactive' ? 'yellow' : 'red'}
                  className="hover:scale-[1.02] transition-transform duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Logo */}
                      <div className="relative">
                        <div className="w-16 h-16 rounded-lg bg-background-secondary flex items-center justify-center overflow-hidden">
                          {team.logo ? (
                            <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
                          ) : (
                            <MdGroup className="text-2xl text-text-secondary" />
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 ${getStatusDot(team.status)}`} />
                      </div>
                      
                      {/* Team Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-text">{team.name}</h3>
                          <span className="text-sm text-text-secondary bg-background-secondary px-2 py-1 rounded">
                            {team.tag}
                          </span>
                          {team.favorite && <MdStar className="text-yellow-400" />}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-text-secondary">{team.region}</span>
                          <span className="text-sm text-text-secondary">•</span>
                          <span className="text-sm text-text-secondary">
                            Fundado em {new Date(team.founded).getFullYear()}
                          </span>
                          <span className="text-sm text-text-secondary">•</span>
                          <span className={`text-sm ${getStatusColor(team.status)}`}>
                            {team.status === 'active' ? 'Ativo' : 
                             team.status === 'inactive' ? 'Inativo' : 'Dissolvido'}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">
                          Última partida {formatLastMatch(team.lastMatch)}
                        </div>
                        {team.achievements.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <MdEmojiEvents className="text-yellow-400 text-sm" />
                            <span className="text-xs text-text-secondary">
                              {team.achievements[0]}
                              {team.achievements.length > 1 && ` +${team.achievements.length - 1}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{team.stats.rating}</div>
                        <div className="text-xs text-text-secondary">Rating</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{team.stats.winRate.toFixed(1)}%</div>
                        <div className="text-xs text-text-secondary">Win Rate</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-text">{team.stats.matches}</div>
                        <div className="text-xs text-text-secondary">Partidas</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <MdPeople className="text-text-secondary" />
                          <span className="text-lg font-semibold text-text">{team.players.length}</span>
                        </div>
                        <div className="text-xs text-text-secondary">Jogadores</div>
                      </div>
                      
                      {/* Recent Form */}
                      <div className="text-center">
                        {renderRecentForm(team.recentForm)}
                        <div className="text-xs text-text-secondary mt-1">Forma</div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(team.id);
                          }}
                          className="p-2 rounded-lg hover:bg-background-secondary transition-colors"
                        >
                          {team.favorite ? (
                            <MdStar className="text-yellow-400" />
                          ) : (
                            <MdStarBorder className="text-text-secondary group-hover:text-yellow-400 transition-colors" />
                          )}
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/teams/${team.id}/edit`);
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

export default TeamsPage;