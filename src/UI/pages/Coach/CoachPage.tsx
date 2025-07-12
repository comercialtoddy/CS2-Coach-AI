import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MdPsychology, 
  MdTrendingUp, 
  MdWarning, 
  MdLightbulb,
  MdTarget,
  MdAnalytics,
  MdSend,
  MdMic,
  MdMicOff,
  MdSettings,
  MdRefresh,
  MdStar,
  MdThumbUp,
  MdThumbDown,
  MdHistory,
  MdSmartToy
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';

interface CoachSuggestion {
  id: string;
  type: 'improvement' | 'warning' | 'tip' | 'strategy';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  timestamp: string;
  rating?: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'coach';
  content: string;
  timestamp: string;
  suggestions?: CoachSuggestion[];
}

const mockSuggestions: CoachSuggestion[] = [
  {
    id: '1',
    type: 'improvement',
    title: 'Melhore sua mira',
    description: 'Sua precisão com rifles diminuiu 15% nas últimas 10 partidas. Pratique no aim_botz por 20 minutos antes de jogar.',
    priority: 'high',
    category: 'Aim',
    timestamp: '5 min atrás'
  },
  {
    id: '2',
    type: 'strategy',
    title: 'Posicionamento em Dust2',
    description: 'Você está morrendo muito no site A. Tente variar suas posições e use mais smokes para cobrir rotações.',
    priority: 'medium',
    category: 'Posicionamento',
    timestamp: '1 hora atrás'
  },
  {
    id: '3',
    type: 'tip',
    title: 'Economia de rounds',
    description: 'Você está forçando compras desnecessárias. Considere fazer eco quando o time não tem dinheiro suficiente.',
    priority: 'medium',
    category: 'Economia',
    timestamp: '2 horas atrás'
  },
  {
    id: '4',
    type: 'warning',
    title: 'Padrão de jogo previsível',
    description: 'Você está sempre indo para o mesmo spot em Mirage. Varie suas posições para ser menos previsível.',
    priority: 'high',
    category: 'Estratégia',
    timestamp: '1 dia atrás'
  }
];

const mockChatHistory: ChatMessage[] = [
  {
    id: '1',
    type: 'user',
    content: 'Como posso melhorar minha performance em Dust2?',
    timestamp: '10:30'
  },
  {
    id: '2',
    type: 'coach',
    content: 'Baseado na sua análise, vejo que você tem dificuldades no site A. Recomendo praticar posições mais defensivas e usar utility de forma mais eficiente.',
    timestamp: '10:31',
    suggestions: [
      {
        id: 'chat-1',
        type: 'tip',
        title: 'Posições defensivas no site A',
        description: 'Tente jogar de default, ninja ou plataforma para ter mais opções de escape.',
        priority: 'medium',
        category: 'Posicionamento',
        timestamp: '10:31'
      }
    ]
  },
  {
    id: '3',
    type: 'user',
    content: 'Qual é a melhor forma de usar granadas?',
    timestamp: '10:35'
  },
  {
    id: '4',
    type: 'coach',
    content: 'Para Dust2, foque em smokes para long A e xbox, flashes para entradas no site B, e HE grenades para dano em grupos. Pratique os lineups no mapa de treino.',
    timestamp: '10:36'
  }
];

export const CoachPage: React.FC = () => {
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>(mockSuggestions);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(mockChatHistory);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'Aim', 'Posicionamento', 'Economia', 'Estratégia', 'Utility'];

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setChatHistory(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const coachResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'coach',
        content: 'Analisando sua pergunta... Baseado nos seus dados recentes, aqui estão algumas recomendações personalizadas.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatHistory(prev => [...prev, coachResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const handleVoiceToggle = () => {
    setIsListening(!isListening);
    // Here you would implement voice recognition
  };

  const handleRateSuggestion = (suggestionId: string, rating: number) => {
    setSuggestions(prev => 
      prev.map(s => s.id === suggestionId ? { ...s, rating } : s)
    );
  };

  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.category === selectedCategory);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-text-secondary';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'improvement': return <MdTrendingUp />;
      case 'warning': return <MdWarning />;
      case 'tip': return <MdLightbulb />;
      case 'strategy': return <MdTarget />;
      default: return <MdAnalytics />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'improvement': return 'blue';
      case 'warning': return 'red';
      case 'tip': return 'yellow';
      case 'strategy': return 'purple';
      default: return 'gray';
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
            <MdSmartToy className="text-primary" />
            AI Coach
          </h1>
          <p className="text-text-secondary mt-1">
            Assistente inteligente para melhorar sua performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <HUDButton
            variant="secondary"
            icon={<MdSettings />}
          >
            Configurações
          </HUDButton>
          
          <HUDButton
            variant="secondary"
            icon={<MdRefresh />}
          >
            Atualizar
          </HUDButton>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggestions Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 space-y-4"
        >
          <HUDCard title="Sugestões Personalizadas" glowColor="blue">
            {/* Category Filter */}
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary text-white'
                        : 'bg-background-secondary text-text-secondary hover:bg-background-primary'
                    }`}
                  >
                    {category === 'all' ? 'Todas' : category}
                  </button>
                ))}
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredSuggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <HUDCard 
                    title="" 
                    glowColor={getTypeColor(suggestion.type)}
                    className="p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${getTypeColor(suggestion.type)}-500/20`}>
                        <span className={`text-${getTypeColor(suggestion.type)}-400`}>
                          {getTypeIcon(suggestion.type)}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-text text-sm">{suggestion.title}</h4>
                          <span className={`text-xs ${getPriorityColor(suggestion.priority)}`}>
                            {suggestion.priority.toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-text-secondary mb-2">
                          {suggestion.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">
                            {suggestion.category} • {suggestion.timestamp}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleRateSuggestion(suggestion.id, 1)}
                              className={`p-1 rounded transition-colors ${
                                suggestion.rating === 1 ? 'text-green-400' : 'text-text-secondary hover:text-green-400'
                              }`}
                            >
                              <MdThumbUp className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleRateSuggestion(suggestion.id, -1)}
                              className={`p-1 rounded transition-colors ${
                                suggestion.rating === -1 ? 'text-red-400' : 'text-text-secondary hover:text-red-400'
                              }`}
                            >
                              <MdThumbDown className="text-xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </HUDCard>
                </motion.div>
              ))}
            </div>
          </HUDCard>
        </motion.div>

        {/* Chat Interface */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <HUDCard title="Chat com AI Coach" glowColor="green" className="h-full flex flex-col">
            {/* Chat History */}
            <div className="flex-1 space-y-4 mb-4 max-h-96 overflow-y-auto">
              {chatHistory.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    message.type === 'user' 
                      ? 'bg-primary text-white' 
                      : 'bg-background-secondary text-text'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {message.type === 'coach' && <MdPsychology className="text-primary" />}
                      <span className="text-xs opacity-75">
                        {message.type === 'user' ? 'Você' : 'AI Coach'} • {message.timestamp}
                      </span>
                    </div>
                    
                    <p className="text-sm">{message.content}</p>
                    
                    {message.suggestions && (
                      <div className="mt-3 space-y-2">
                        {message.suggestions.map((suggestion) => (
                          <div key={suggestion.id} className="p-2 bg-background-primary rounded border-l-2 border-primary">
                            <p className="text-xs font-medium">{suggestion.title}</p>
                            <p className="text-xs opacity-75">{suggestion.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-background-secondary text-text p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MdPsychology className="text-primary animate-pulse" />
                      <span className="text-sm">AI Coach está pensando...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Pergunte algo ao AI Coach..."
                  className="w-full px-4 py-3 bg-background-secondary border border-border rounded-lg text-text placeholder-text-secondary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              
              <HUDButton
                variant={isListening ? 'primary' : 'secondary'}
                onClick={handleVoiceToggle}
                icon={isListening ? <MdMic /> : <MdMicOff />}
                className={isListening ? 'animate-pulse' : ''}
              />
              
              <HUDButton
                variant="primary"
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading}
                icon={<MdSend />}
              >
                Enviar
              </HUDButton>
            </div>
          </HUDCard>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <HUDCard title="Sugestões Aplicadas" glowColor="green" className="text-center">
          <div className="text-2xl font-bold text-green-400">12</div>
          <div className="text-xs text-text-secondary mt-1">Esta semana</div>
        </HUDCard>
        
        <HUDCard title="Melhoria Média" glowColor="blue" className="text-center">
          <div className="text-2xl font-bold text-blue-400">+15%</div>
          <div className="text-xs text-text-secondary mt-1">Performance geral</div>
        </HUDCard>
        
        <HUDCard title="Sessões de Coach" glowColor="purple" className="text-center">
          <div className="text-2xl font-bold text-purple-400">8</div>
          <div className="text-xs text-text-secondary mt-1">Este mês</div>
        </HUDCard>
        
        <HUDCard title="Avaliação" glowColor="yellow" className="text-center">
          <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1">
            4.8 <MdStar className="text-lg" />
          </div>
          <div className="text-xs text-text-secondary mt-1">Satisfação</div>
        </HUDCard>
      </motion.div>
    </div>
  );
};

export default CoachPage;