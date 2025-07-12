import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MdDashboard, 
  MdTrendingUp, 
  MdTrendingDown, 
  MdSportsEsports,
  MdPeople,
  MdBarChart,
  MdMap,
  MdSettings,
  MdRefresh,
  MdPlayArrow,
  MdStop,
  MdAnalytics,
  MdEmojiEvents,
  MdTimer,
  MdTarget
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { useMatches, usePlayers, useTeams } from '../../hooks';

interface DashboardStats {
  kdRatio: number;
  winRate: number;
  totalMatches: number;
  adr: number;
  headshots: number;
  mvps: number;
  rating: number;
  hoursPlayed: number;
  rank: string;
  recentTrend: 'up' | 'down' | 'stable';
}

interface RecentMatch {
  id: string;
  map: string;
  result: 'win' | 'loss' | 'tie';
  score: string;
  kda: string;
  date: string;
  duration: string;
  mvp: boolean;
  rating: number;
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  disabled?: boolean;
}

const mockStats: DashboardStats = {
  kdRatio: 1.25,
  winRate: 68.5,
  totalMatches: 142,
  adr: 78.5,
  headshots: 45.2,
  mvps: 23,
  rating: 1.18,
  hoursPlayed: 1247,
  rank: 'Global Elite',
  recentTrend: 'up'
};

const mockRecentMatches: RecentMatch[] = [
  {
    id: '1',
    map: 'de_dust2',
    result: 'win',
    score: '16-12',
    kda: '18/14/5',
    date: '2 horas atrás',
    duration: '42:15',
    mvp: true,
    rating: 1.32
  },
  {
    id: '2',
    map: 'de_mirage',
    result: 'loss',
    score: '13-16',
    kda: '15/18/7',
    date: '1 dia atrás',
    duration: '38:22',
    mvp: false,
    rating: 0.89
  },
  {
    id: '3',
    map: 'de_inferno',
    result: 'win',
    score: '16-8',
    kda: '22/10/4',
    date: '1 dia atrás',
    duration: '35:45',
    mvp: true,
    rating: 1.45
  },
  {
    id: '4',
    map: 'de_cache',
    result: 'win',
    score: '16-14',
    kda: '19/16/6',
    date: '2 dias atrás',
    duration: '44:12',
    mvp: false,
    rating: 1.12
  },
  {
    id: '5',
    map: 'de_overpass',
    result: 'tie',
    score: '15-15',
    kda: '16/15/8',
    date: '3 dias atrás',
    duration: '47:33',
    mvp: false,
    rating: 1.05
  }
];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>(mockRecentMatches);
  const [isLoading, setIsLoading] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);
  const navigate = useNavigate();

  const { matches, loading: matchesLoading } = useMatches();
  const { players, loading: playersLoading } = usePlayers();
  const { teams, loading: teamsLoading } = useTeams();

  useEffect(() => {
    // Simulate checking if CS2 is running
    const checkGameStatus = () => {
      // This would be replaced with actual game detection logic
      setIsGameRunning(Math.random() > 0.5);
    };

    checkGameStatus();
    const interval = setInterval(checkGameStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Here you would refresh all data
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      title: 'Análise de Performance',
      description: 'Dashboard completo de estatísticas',
      icon: <MdAnalytics />,
      path: '/performance',
      color: 'blue'
    },
    {
      title: 'Histórico de Partidas',
      description: 'Visualizar todas as partidas',
      icon: <MdSportsEsports />,
      path: '/matches',
      color: 'green'
    },
    {
      title: 'Gerenciar Jogadores',
      description: 'Perfis e estatísticas',
      icon: <MdPeople />,
      path: '/players',
      color: 'purple'
    },
    {
      title: 'Times',
      description: 'Análise de equipes',
      icon: <MdEmojiEvents />,
      path: '/teams',
      color: 'orange'
    },
    {
      title: 'AI Coach',
      description: 'Assistente inteligente',
      icon: <MdTarget />,
      path: '/coach',
      color: 'red',
      disabled: true
    },
    {
      title: 'Configurações',
      description: 'Personalizar aplicação',
      icon: <MdSettings />,
      path: '/settings',
      color: 'gray'
    }
  ];

  const formatDuration = (duration: string) => {
    return duration;
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
      case 'win': return '🏆';
      case 'loss': return '💀';
      case 'tie': return '🤝';
      default: return '❓';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <MdTrendingUp className="text-green-400" />;
      case 'down': return <MdTrendingDown className="text-red-400" />;
      default: return <span className="text-yellow-400">→</span>;
    }
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
            <MdDashboard className="text-primary" />
            Dashboard
          </h1>
          <p className="text-text-secondary mt-1">
            Visão geral da sua performance no CS2
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Game Status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background-secondary">
            <div className={`w-3 h-3 rounded-full ${isGameRunning ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-text">
              CS2 {isGameRunning ? 'Rodando' : 'Offline'}
            </span>
          </div>
          
          <HUDButton
            variant="secondary"
            onClick={handleRefresh}
            loading={isLoading}
            icon={<MdRefresh />}
          >
            Atualizar
          </HUDButton>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4"
      >
        <HUDCard title="K/D Ratio" glowColor="blue" className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.kdRatio}</div>
          <div className="flex items-center justify-center gap-1 text-xs mt-1">
            {getTrendIcon(stats.recentTrend)}
            <span className="text-text-secondary">+0.15 esta semana</span>
          </div>
        </HUDCard>
        
        <HUDCard title="Win Rate" glowColor="green" className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.winRate}%</div>
          <div className="text-xs text-text-secondary mt-1">+5% esta semana</div>
        </HUDCard>
        
        <HUDCard title="Rating" glowColor="purple" className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.rating}</div>
          <div className="text-xs text-text-secondary mt-1">{stats.rank}</div>
        </HUDCard>
        
        <HUDCard title="ADR" glowColor="orange" className="text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.adr}</div>
          <div className="text-xs text-text-secondary mt-1">+3.2 esta semana</div>
        </HUDCard>
        
        <HUDCard title="HS%" glowColor="red" className="text-center">
          <div className="text-2xl font-bold text-red-400">{stats.headshots}%</div>
          <div className="text-xs text-text-secondary mt-1">-1.8% esta semana</div>
        </HUDCard>
        
        <HUDCard title="MVPs" glowColor="yellow" className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.mvps}</div>
          <div className="text-xs text-text-secondary mt-1">Este mês</div>
        </HUDCard>
      </motion.div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <HUDCard title="Partidas Recentes" glowColor="blue">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text">Últimas 5 Partidas</h3>
              <Link 
                to="/matches" 
                className="text-primary hover:text-primary-dark transition-colors text-sm flex items-center gap-1"
              >
                Ver Todas <MdPlayArrow className="text-xs" />
              </Link>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentMatches.map((match, index) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={`/matches/${match.id}`}
                    className="flex items-center justify-between p-3 bg-background-secondary rounded-lg hover:bg-background-primary transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getResultIcon(match.result)}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text">{match.map}</p>
                          {match.mvp && <span className="text-xs bg-yellow-400 text-black px-1 rounded">MVP</span>}
                        </div>
                        <p className="text-sm text-text-secondary">{match.date}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getResultColor(match.result)}`}>
                          {match.score}
                        </span>
                        <span className="text-sm text-text-secondary">
                          {match.rating}
                        </span>
                      </div>
                      <div className="text-sm text-text-secondary">
                        {match.kda} • {formatDuration(match.duration)}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </HUDCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <HUDCard title="Ações Rápidas" glowColor="green">
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                >
                  <button
                    onClick={() => !action.disabled && navigate(action.path)}
                    disabled={action.disabled}
                    className={`w-full p-3 rounded-lg transition-all duration-200 text-left ${
                      action.disabled 
                        ? 'bg-background-secondary opacity-50 cursor-not-allowed' 
                        : 'bg-background-secondary hover:bg-background-primary hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        action.disabled ? 'bg-gray-600' : `bg-${action.color}-500/20`
                      }`}>
                        <span className={`text-lg ${
                          action.disabled ? 'text-gray-400' : `text-${action.color}-400`
                        }`}>
                          {action.icon}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          action.disabled ? 'text-text-secondary' : 'text-text'
                        }`}>
                          {action.title}
                          {action.disabled && <span className="text-xs ml-2">(Em Breve)</span>}
                        </p>
                        <p className="text-xs text-text-secondary">{action.description}</p>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </HUDCard>

          {/* System Status */}
          <HUDCard title="Status do Sistema" glowColor="purple">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Partidas Carregadas</span>
                <span className="text-sm text-text">{stats.totalMatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Horas Jogadas</span>
                <span className="text-sm text-text">{stats.hoursPlayed}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Última Sincronização</span>
                <span className="text-sm text-text">Agora mesmo</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Status da API</span>
                <span className="text-sm text-green-400">Online</span>
              </div>
            </div>
          </HUDCard>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;