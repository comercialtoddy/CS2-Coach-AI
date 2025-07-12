import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MdSettings, 
  MdVolumeUp, 
  MdMic, 
  MdNotifications, 
  MdGamepad,
  MdFolder,
  MdLanguage,
  MdPalette,
  MdSecurity,
  MdUpdate
} from 'react-icons/md';
import { HUDCard } from '../../components/HUDCard';
import { HUDButton } from '../../components/HUDButton';
import { usePerformance } from '../../hooks';
import axios from 'axios';
import { apiUrl } from '../../api/api';

interface UnifiedSettingsData {
  // Audio Settings
  masterVolume: number;
  voiceVolume: number;
  effectsVolume: number;
  micEnabled: boolean;
  
  // Game Settings
  autoSwitch: boolean;
  layout: string;
  hudOpacity: number;
  
  // Notification Settings
  enableNotifications: boolean;
  soundNotifications: boolean;
  
  // AI Settings
  aiModel: string;
  voiceEnabled: boolean;
  coachingLevel: 'beginner' | 'intermediate' | 'advanced';
  
  // Appearance
  theme: 'dark' | 'light' | 'auto';
  language: string;
}

const defaultSettings: UnifiedSettingsData = {
  masterVolume: 80,
  voiceVolume: 70,
  effectsVolume: 60,
  micEnabled: true,
  autoSwitch: false,
  layout: 'vertical',
  hudOpacity: 85,
  enableNotifications: true,
  soundNotifications: true,
  aiModel: 'gpt-4',
  voiceEnabled: true,
  coachingLevel: 'intermediate',
  theme: 'dark',
  language: 'en'
};

export const UnifiedSettings: React.FC = () => {
  const [settings, setSettings] = useState<UnifiedSettingsData>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('game');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { settings: performanceSettings, updateSettings: updatePerformanceSettings } = usePerformance();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${apiUrl}/settings`);
      if (response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setErrorMessage('Erro ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      await axios.put(`${apiUrl}/settings`, settings);
      if (performanceSettings) {
        await updatePerformanceSettings({
          ...performanceSettings,
          volume: settings.masterVolume,
          voiceEnabled: settings.voiceEnabled
        });
      }
      setSuccessMessage('Configurações salvas com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setErrorMessage('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof UnifiedSettingsData>(
    key: K,
    value: UnifiedSettingsData[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'game', label: 'Jogo', icon: MdGamepad },
    { id: 'audio', label: 'Áudio', icon: MdVolumeUp },
    { id: 'ai', label: 'IA Coach', icon: MdSettings },
    { id: 'appearance', label: 'Aparência', icon: MdPalette },
    { id: 'system', label: 'Sistema', icon: MdSecurity }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Carregando configurações...</p>
        </div>
      </div>
    );
  }

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
            <MdSettings className="text-primary" />
            Configurações
          </h1>
          <p className="text-text-secondary mt-1">Personalize sua experiência no CS2 Coach AI</p>
        </div>
        
        <div className="flex gap-3">
          <HUDButton
            variant="secondary"
            onClick={() => window.electron.openHudsDirectory()}
            icon={<MdFolder />}
          >
            Abrir Diretório
          </HUDButton>
          <HUDButton
            variant="success"
            onClick={saveSettings}
            loading={isSaving}
            icon={<MdUpdate />}
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </HUDButton>
        </div>
      </motion.div>

      {/* Messages */}
      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200"
        >
          {errorMessage}
        </motion.div>
      )}
      
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-green-200"
        >
          {successMessage}
        </motion.div>
      )}

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200
                  ${activeTab === tab.id 
                    ? 'bg-primary/20 border border-primary/50 text-primary' 
                    : 'hover:bg-background-secondary/50 text-text-secondary hover:text-text'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="text-xl" />
                <span className="font-medium">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'game' && (
            <div className="space-y-6">
              <HUDCard title="Configurações de Jogo" glowColor="blue">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-text font-medium">Auto-switch de Lados</label>
                    <button
                      onClick={() => updateSetting('autoSwitch', !settings.autoSwitch)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${settings.autoSwitch ? 'bg-primary' : 'bg-gray-600'}
                      `}
                    >
                      <div className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${settings.autoSwitch ? 'translate-x-7' : 'translate-x-1'}
                      `} />
                    </button>
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">Layout do HUD</label>
                    <select
                      value={settings.layout}
                      onChange={(e) => updateSetting('layout', e.target.value)}
                      className="w-full bg-background-secondary border border-border rounded-lg p-2 text-text"
                    >
                      <option value="vertical">Vertical</option>
                      <option value="horizontal">Horizontal</option>
                      <option value="compact">Compacto</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">
                      Opacidade do HUD: {settings.hudOpacity}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.hudOpacity}
                      onChange={(e) => updateSetting('hudOpacity', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </HUDCard>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-6">
              <HUDCard title="Configurações de Áudio" glowColor="green">
                <div className="space-y-4">
                  <div>
                    <label className="text-text font-medium block mb-2">
                      Volume Geral: {settings.masterVolume}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.masterVolume}
                      onChange={(e) => updateSetting('masterVolume', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">
                      Volume da Voz: {settings.voiceVolume}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.voiceVolume}
                      onChange={(e) => updateSetting('voiceVolume', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">
                      Volume dos Efeitos: {settings.effectsVolume}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.effectsVolume}
                      onChange={(e) => updateSetting('effectsVolume', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-text font-medium">Microfone Habilitado</label>
                    <button
                      onClick={() => updateSetting('micEnabled', !settings.micEnabled)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${settings.micEnabled ? 'bg-primary' : 'bg-gray-600'}
                      `}
                    >
                      <div className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${settings.micEnabled ? 'translate-x-7' : 'translate-x-1'}
                      `} />
                    </button>
                  </div>
                </div>
              </HUDCard>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <HUDCard title="Configurações da IA" glowColor="purple">
                <div className="space-y-4">
                  <div>
                    <label className="text-text font-medium block mb-2">Modelo de IA</label>
                    <select
                      value={settings.aiModel}
                      onChange={(e) => updateSetting('aiModel', e.target.value)}
                      className="w-full bg-background-secondary border border-border rounded-lg p-2 text-text"
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3">Claude 3</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">Nível de Coaching</label>
                    <select
                      value={settings.coachingLevel}
                      onChange={(e) => updateSetting('coachingLevel', e.target.value as any)}
                      className="w-full bg-background-secondary border border-border rounded-lg p-2 text-text"
                    >
                      <option value="beginner">Iniciante</option>
                      <option value="intermediate">Intermediário</option>
                      <option value="advanced">Avançado</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-text font-medium">Voz da IA Habilitada</label>
                    <button
                      onClick={() => updateSetting('voiceEnabled', !settings.voiceEnabled)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${settings.voiceEnabled ? 'bg-primary' : 'bg-gray-600'}
                      `}
                    >
                      <div className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${settings.voiceEnabled ? 'translate-x-7' : 'translate-x-1'}
                      `} />
                    </button>
                  </div>
                </div>
              </HUDCard>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <HUDCard title="Aparência" glowColor="orange">
                <div className="space-y-4">
                  <div>
                    <label className="text-text font-medium block mb-2">Tema</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => updateSetting('theme', e.target.value as any)}
                      className="w-full bg-background-secondary border border-border rounded-lg p-2 text-text"
                    >
                      <option value="dark">Escuro</option>
                      <option value="light">Claro</option>
                      <option value="auto">Automático</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-text font-medium block mb-2">Idioma</label>
                    <select
                      value={settings.language}
                      onChange={(e) => updateSetting('language', e.target.value)}
                      className="w-full bg-background-secondary border border-border rounded-lg p-2 text-text"
                    >
                      <option value="pt">Português</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
              </HUDCard>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              <HUDCard title="Sistema" glowColor="red">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-text font-medium">Notificações</label>
                    <button
                      onClick={() => updateSetting('enableNotifications', !settings.enableNotifications)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${settings.enableNotifications ? 'bg-primary' : 'bg-gray-600'}
                      `}
                    >
                      <div className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${settings.enableNotifications ? 'translate-x-7' : 'translate-x-1'}
                      `} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-text font-medium">Sons de Notificação</label>
                    <button
                      onClick={() => updateSetting('soundNotifications', !settings.soundNotifications)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${settings.soundNotifications ? 'bg-primary' : 'bg-gray-600'}
                      `}
                    >
                      <div className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200
                        ${settings.soundNotifications ? 'translate-x-7' : 'translate-x-1'}
                      `} />
                    </button>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-text font-medium mb-3">Ações do Sistema</h4>
                    <div className="space-y-2">
                      <HUDButton
                        variant="secondary"
                        onClick={() => window.electron.openHudsDirectory()}
                        icon={<MdFolder />}
                        className="w-full"
                      >
                        Abrir Diretório de HUDs
                      </HUDButton>
                      
                      <HUDButton
                        variant="danger"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja resetar todas as configurações?')) {
                            setSettings(defaultSettings);
                          }
                        }}
                        className="w-full"
                      >
                        Resetar Configurações
                      </HUDButton>
                    </div>
                  </div>
                </div>
              </HUDCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};