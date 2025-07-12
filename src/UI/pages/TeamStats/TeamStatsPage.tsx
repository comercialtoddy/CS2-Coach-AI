import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MdGroup, 
  MdTrendingUp, 
  MdTrendingDown, 
  MdBarChart,
  MdPieChart,
  MdTimeline,
  MdCompare,
  MdFilterList,
  MdRefresh,
  MdDownload,
  MdShare,
  MdEmojiEvents,
  MdStar,
  MdTarget,
  MdSpeed,
  MdSecurity,
  MdLocalFireDepartment
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { BarChart, RadarChart, PerformanceChart } from '../../components/charts';

interface TeamStats {
  id: string;
  name: string;
  logo?: string;
  totalMatches: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  avgRating: number;
  avgKD: number;
  avgADR: number;
  avgHSP: number;
  totalRounds: number;
  roundsWon: number;
  roundWinRate: number;
  pistolRoundWinRate: number;
  ecoRoundWinRate: number;
  forceRoundWinRate: number;
  clutchSuccessRate: number;
  firstKillRate: number;
  entryFragSuccessRate: number;
  tradeKillRate: number;
  utilityDamage: number;
  flashAssists: number;
  supportRating: number;
  teamworkRating: number;
  communicationRating: number;
  strategyRating: number;
  recentForm: ('W' | 'L' | 'T')[];
  mapStats: MapStat[];
  playerStats: PlayerStat[];
  trends: {
    winRate: number;
    rating: number;
    teamwork: number;
  };
}

interface MapStat {
  map: string;
  matches: number;
  wins: number;
  winRate: number;
  avgRounds: number;
  ctWinRate: number;
  tWinRate: number;
  avgRating: number;
}

interface PlayerStat {
  id: string;
  name: string;
  role: string;
  matches: number;
  rating: number;
  kd: number;
  adr: number;
  hsp: number;
  clutches: number;
  mvps: number;
  impact: number;
}

const mockTeamStats: TeamStats = {
  id: '1',
  name: 'Team Alpha',
  totalMatches: 45,
  wins: 28,
  losses: 15,
  ties: 2,
  winRate: 62.2,
  avgRating: 1.08,
  avgKD: 1.15,
  avgADR: 76.8,
  avgHSP: 42.5,
  totalRounds: 1247,
  roundsWon: 678,
  roundWinRate: 54.4,
  pistolRoundWinRate: 58.9,
  ecoRoundWinRate: 23.1,
  forceRoundWinRate: 41.7,
  clutchSuccessRate: 34.2,
  firstKillRate: 52.8,
  entryFragSuccessRate: 67.3,
  tradeKillRate: 78.9,
  utilityDamage: 156.7,
  flashAssists: 8.3,
  supportRating: 0.85,
  teamworkRating: 8.2,
  communicationRating: 7.8,
  strategyRating: 8.5,
  recentForm: ['W', 'W', 'L', 'W', 'W', 'T', 'W', 'L', 'W', 'W'],
  mapStats: [
    { map: 'de_dust2', matches: 12, wins: 8, winRate: 66.7, avgRounds: 27.5, ctWinRate: 58.3, tWinRate: 41.7, avgRating: 1.12 },
    { map: 'de_mirage', matches: 10, wins: 7, winRate: 70.0, avgRounds: 26.8, ctWinRate: 62.1, tWinRate: 37.9, avgRating: 1.15 },
    { map: 'de_inferno', matches: 8, wins: 5, winRate: 62.5, avgRounds: 28.1, ctWinRate: 55.6, tWinRate: 44.4, avgRating: 1.05 },
    { map: 'de_cache', matches: 7, wins: 4, winRate: 57.1, avgRounds: 29.3, ctWinRate: 51.2, tWinRate: 48.8, avgRating: 1.02 },
    { map: 'de_overpass', matches: 5, wins: 3, winRate: 60.0, avgRounds: 27.8, ctWinRate: 56.7, tWinRate: 43.3, avgRating: 1.08 },
    { map: 'de_nuke', matches: 3, wins: 1, winRate: 33.3, avgRounds: 30.7, ctWinRate: 45.5, tWinRate: 54.5, avgRating: 0.95 }
  ],
  playerStats: [
    { id: '1', name: 'Player1', role: 'AWPer', matches: 42, rating: 1.25, kd: 1.35, adr: 85.2, hsp: 38.7, clutches: 12, mvps: 15, impact: 1.18 },
    { id: '2', name: 'Player2', role: 'Entry Fragger', matches: 45, rating: 1.15, kd: 1.28, adr: 82.1, hsp: 45.3, clutches: 8, mvps: 12, impact: 1.12 },
    { id: '3', name: 'Player3', role: 'IGL', matches: 45, rating: 1.02, kd: 1.08, adr: 72.5, hsp: 41.2, clutches: 15, mvps: 8, impact: 1.25 },
    { id: '4', name: 'Player4', role: 'Support', matches: 43, rating: 0.98, kd: 0.95, adr: 68.9, hsp: 39.8, clutches: 6, mvps: 5, impact: 0.92 },
    { id: '5', name: 'Player5', role: 'Lurker', matches: 40, rating: 1.08, kd: 1.18, adr: 75.3, hsp: 47.1, clutches: 10, mvps: 9, impact: 1.05 }
  ],
  trends: {
    winRate: 5.2,
    rating: 0.08,
    teamwork: 0.3
  }
};

const timeRanges = [
  { label: 'Última Semana', value: '7d' },
  { label: 'Último Mês', value: '30d' },
  { label: 'Últimos 3 Meses', value: '90d' },
  { label: 'Todos os Tempos', value: 'all' }
];

export const TeamStatsPage: React.FC = () => {
  const [teamStats, setTeamStats] = useState<TeamStats>(mockTeamStats);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedView, setSelectedView] = useState<'overview' | 'maps' | 'players' | 'trends'>('overview');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Here you would fetch updated team stats
    } catch (error) {
      console.error('Error refreshing team stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <MdTrendingUp className="text-green-400" />;
    if (value < 0) return <MdTrendingDown className="text-red-400" />;
    return <span className="text-yellow-400">→</span>;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-yellow-400';
  };

  const getFormIcon = (result: string) => {
    switch (result) {
      case 'W': return '🏆';
      case 'L': return '💀';
      case 'T': return '🤝';
      default: return '❓';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'AWPer': return '🎯';
      case 'Entry Fragger': return '⚡';
      case 'IGL': return '🧠';
      case 'Support': return '🛡️';
      case 'Lurker': return '👤';
      default: return '🎮';
    }
  };

  const radarData = [
    { subject: 'Aim', A: teamStats.avgRating * 100, fullMark: 150 },
    { subject: 'Teamwork', A: teamStats.teamworkRating * 10, fullMark: 100 },
    { subject: 'Strategy', A: teamStats.strategyRating * 10, fullMark: 100 },
    { subject: 'Communication', A: teamStats.communicationRating * 10, fullMark: 100 },
    { subject: 'Clutch', A: teamStats.clutchSuccessRate, fullMark: 100 },
    { subject: 'Entry', A: teamStats.entryFragSuccessRate, fullMark: 100 }
  ];

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
            Estatísticas do Time
          </h1>
          <p className="text-text-secondary mt-1">
            Análise completa da performance da equipe
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 bg-background-secondary border border-border rounded-lg text-text focus:outline-none focus:border-primary"
          >
            {timeRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          
          <HUDButton
            variant="secondary"
            onClick={handleRefresh}
            loading={isLoading}
            icon={<MdRefresh />}
          >
            Atualizar
          </HUDButton>
          
          <HUDButton
            variant="secondary"
            icon={<MdDownload />}
          >
            Exportar
          </HUDButton>
        </div>
      </motion.div>

      {/* View Selector */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2"
      >
        {[
          { key: 'overview', label: 'Visão Geral', icon: <MdBarChart /> },
          { key: 'maps', label: 'Mapas', icon: <MdPieChart /> },
          { key: 'players', label: 'Jogadores', icon: <MdGroup /> },
          { key: 'trends', label: 'Tendências', icon: <MdTimeline /> }
        ].map((view) => (
          <button
            key={view.key}
            onClick={() => setSelectedView(view.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedView === view.key
                ? 'bg-primary text-white'
                : 'bg-background-secondary text-text-secondary hover:bg-background-primary hover:text-text'
            }`}
          >
            {view.icon}
            <span className="text-sm">{view.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Overview Stats */}
      {selectedView === 'overview' && (
        <>
          {/* Key Metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4"
          >
            <HUDCard title="Win Rate" glowColor="green" className="text-center">
              <div className="text-2xl font-bold text-green-400">{teamStats.winRate}%</div>
              <div className="flex items-center justify-center gap-1 text-xs mt-1">
                {getTrendIcon(teamStats.trends.winRate)}
                <span className={getTrendColor(teamStats.trends.winRate)}>
                  {teamStats.trends.winRate > 0 ? '+' : ''}{teamStats.trends.winRate}%
                </span>
              </div>
            </HUDCard>
            
            <HUDCard title="Rating Médio" glowColor="blue" className="text-center">
              <div className="text-2xl font-bold text-blue-400">{teamStats.avgRating}</div>
              <div className="flex items-center justify-center gap-1 text-xs mt-1">
                {getTrendIcon(teamStats.trends.rating)}
                <span className={getTrendColor(teamStats.trends.rating)}>
                  {teamStats.trends.rating > 0 ? '+' : ''}{teamStats.trends.rating}
                </span>
              </div>
            </HUDCard>
            
            <HUDCard title="K/D Médio" glowColor="purple" className="text-center">
              <div className="text-2xl font-bold text-purple-400">{teamStats.avgKD}</div>
              <div className="text-xs text-text-secondary mt-1">Por jogador</div>
            </HUDCard>
            
            <HUDCard title="ADR Médio" glowColor="orange" className="text-center">
              <div className="text-2xl font-bold text-orange-400">{teamStats.avgADR}</div>
              <div className="text-xs text-text-secondary mt-1">Dano por round</div>
            </HUDCard>
            
            <HUDCard title="Teamwork" glowColor="yellow" className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{teamStats.teamworkRating}/10</div>
              <div className="flex items-center justify-center gap-1 text-xs mt-1">
                {getTrendIcon(teamStats.trends.teamwork)}
                <span className={getTrendColor(teamStats.trends.teamwork)}>
                  {teamStats.trends.teamwork > 0 ? '+' : ''}{teamStats.trends.teamwork}
                </span>
              </div>
            </HUDCard>
            
            <HUDCard title="Partidas" glowColor="red" className="text-center">
              <div className="text-2xl font-bold text-red-400">{teamStats.totalMatches}</div>
              <div className="text-xs text-text-secondary mt-1">{teamStats.wins}W {teamStats.losses}L {teamStats.ties}T</div>
            </HUDCard>
          </motion.div>

          {/* Main Content Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team Performance Radar */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <HUDCard title="Performance Radar" glowColor="blue">
                <div className="h-64 flex items-center justify-center">
                  <RadarChart data={radarData} />
                </div>
              </HUDCard>
            </motion.div>

            {/* Recent Form & Round Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <HUDCard title="Forma Recente" glowColor="green">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {teamStats.recentForm.map((result, index) => (
                    <span key={index} className="text-lg">
                      {getFormIcon(result)}
                    </span>
                  ))}
                </div>
                <div className="text-center text-sm text-text-secondary">
                  Últimas 10 partidas
                </div>
              </HUDCard>

              <HUDCard title="Estatísticas de Round" glowColor="purple">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Round Win Rate:</span>
                    <span className="text-text font-medium">{teamStats.roundWinRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Pistol Rounds:</span>
                    <span className="text-text font-medium">{teamStats.pistolRoundWinRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Eco Rounds:</span>
                    <span className="text-text font-medium">{teamStats.ecoRoundWinRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Force Rounds:</span>
                    <span className="text-text font-medium">{teamStats.forceRoundWinRate}%</span>
                  </div>
                </div>
              </HUDCard>
            </motion.div>

            {/* Advanced Stats */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4"
            >
              <HUDCard title="Estatísticas Avançadas" glowColor="orange">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Clutch Success:</span>
                    <span className="text-text font-medium">{teamStats.clutchSuccessRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">First Kill Rate:</span>
                    <span className="text-text font-medium">{teamStats.firstKillRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Entry Success:</span>
                    <span className="text-text font-medium">{teamStats.entryFragSuccessRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Trade Kill Rate:</span>
                    <span className="text-text font-medium">{teamStats.tradeKillRate}%</span>
                  </div>
                </div>
              </HUDCard>

              <HUDCard title="Utility & Support" glowColor="yellow">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Utility Damage:</span>
                    <span className="text-text font-medium">{teamStats.utilityDamage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Flash Assists:</span>
                    <span className="text-text font-medium">{teamStats.flashAssists}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Support Rating:</span>
                    <span className="text-text font-medium">{teamStats.supportRating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Communication:</span>
                    <span className="text-text font-medium">{teamStats.communicationRating}/10</span>
                  </div>
                </div>
              </HUDCard>
            </motion.div>
          </div>
        </>
      )}

      {/* Maps View */}
      {selectedView === 'maps' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {teamStats.mapStats.map((mapStat, index) => (
            <motion.div
              key={mapStat.map}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <HUDCard title={mapStat.map} glowColor="blue">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Win Rate:</span>
                    <span className={`font-medium ${
                      mapStat.winRate >= 60 ? 'text-green-400' : 
                      mapStat.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {mapStat.winRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Partidas:</span>
                    <span className="text-text font-medium">{mapStat.matches} ({mapStat.wins}W)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">CT Win Rate:</span>
                    <span className="text-text font-medium">{mapStat.ctWinRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">T Win Rate:</span>
                    <span className="text-text font-medium">{mapStat.tWinRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Avg Rating:</span>
                    <span className="text-text font-medium">{mapStat.avgRating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Avg Rounds:</span>
                    <span className="text-text font-medium">{mapStat.avgRounds}</span>
                  </div>
                </div>
              </HUDCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Players View */}
      {selectedView === 'players' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {teamStats.playerStats.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <HUDCard title="" glowColor="green">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getRoleIcon(player.role)}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-text">{player.name}</h3>
                    <p className="text-sm text-text-secondary">{player.role}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Rating:</span>
                    <span className={`font-medium ${
                      player.rating >= 1.1 ? 'text-green-400' : 
                      player.rating >= 0.9 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {player.rating}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">K/D:</span>
                    <span className="text-text font-medium">{player.kd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">ADR:</span>
                    <span className="text-text font-medium">{player.adr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">HS%:</span>
                    <span className="text-text font-medium">{player.hsp}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Clutches:</span>
                    <span className="text-text font-medium">{player.clutches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">MVPs:</span>
                    <span className="text-text font-medium">{player.mvps}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Impact:</span>
                    <span className="text-text font-medium">{player.impact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Partidas:</span>
                    <span className="text-text font-medium">{player.matches}</span>
                  </div>
                </div>
              </HUDCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Trends View */}
      {selectedView === 'trends' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <HUDCard title="Tendências de Performance" glowColor="purple">
            <div className="h-64">
              <PerformanceChart />
            </div>
          </HUDCard>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HUDCard title="Tendência de Vitórias" glowColor="green" className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {getTrendIcon(teamStats.trends.winRate)}
              </div>
              <div className="text-lg font-medium text-text">
                {teamStats.trends.winRate > 0 ? '+' : ''}{teamStats.trends.winRate}%
              </div>
              <div className="text-sm text-text-secondary">Últimos 30 dias</div>
            </HUDCard>
            
            <HUDCard title="Tendência de Rating" glowColor="blue" className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {getTrendIcon(teamStats.trends.rating)}
              </div>
              <div className="text-lg font-medium text-text">
                {teamStats.trends.rating > 0 ? '+' : ''}{teamStats.trends.rating}
              </div>
              <div className="text-sm text-text-secondary">Últimos 30 dias</div>
            </HUDCard>
            
            <HUDCard title="Tendência de Teamwork" glowColor="yellow" className="text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-2">
                {getTrendIcon(teamStats.trends.teamwork)}
              </div>
              <div className="text-lg font-medium text-text">
                {teamStats.trends.teamwork > 0 ? '+' : ''}{teamStats.trends.teamwork}
              </div>
              <div className="text-sm text-text-secondary">Últimos 30 dias</div>
            </HUDCard>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TeamStatsPage;