import React, { useEffect } from 'react';
import { usePerformance } from '../../hooks';

/**
 * Settings Section
 * 
 * Allows users to configure:
 * - Agent voice settings
 * - Audio volume
 * - OpenRouter model selection
 * - Dashboard preferences
 * - Notification settings
 */
export const Settings: React.FC = () => {
  const {
    settings,
    isLoadingSettings,
    settingsError,
    loadSettings,
    updateSettings
  } = usePerformance();

  // Load initial settings
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (isLoadingSettings && !settings) {
    return (
      <div className="space-y-8">
        {[...Array(3)].map((_, i) => (
          <section key={i} className="space-y-4">
            <div className="h-6 w-32 bg-background-primary rounded animate-pulse" />
            <div className="bg-background-primary rounded-lg p-4 space-y-4">
              {[...Array(2)].map((_, j) => (
                <div key={j}>
                  <div className="h-5 w-24 bg-background-secondary rounded mb-2 animate-pulse" />
                  <div className="h-10 w-full bg-background-secondary rounded animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Error Loading Settings</h3>
        <p className="mb-4">{settingsError.message}</p>
        <button
          onClick={loadSettings}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  const handleVoiceSettingsChange = (
    field: keyof typeof settings.voice,
    value: string | number
  ) => {
    updateSettings({
      voice: {
        ...settings.voice,
        [field]: value
      }
    });
  };

  const handleAISettingsChange = (
    field: keyof typeof settings.ai,
    value: string
  ) => {
    updateSettings({
      ai: {
        ...settings.ai,
        [field]: value
      }
    });
  };

  const handleDisplaySettingsChange = (
    field: keyof typeof settings.display,
    value: boolean
  ) => {
    updateSettings({
      display: {
        ...settings.display,
        [field]: value
      }
    });
  };

  const handleNotificationSettingsChange = (
    field: keyof typeof settings.notifications,
    value: boolean
  ) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Voice Settings */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Voice Settings</h3>
        <div className="bg-background-primary rounded-lg p-4 space-y-4">
          {/* Voice Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Agent Voice</label>
            <select
              className="w-full bg-background-secondary text-text px-4 py-2 rounded-lg"
              value={settings.voice.model}
              onChange={e => handleVoiceSettingsChange('model', e.target.value)}
            >
              <option value="en-US-ryan">Ryan (US English)</option>
              <option value="en-GB-alice">Alice (British English)</option>
              <option value="en-AU-james">James (Australian English)</option>
            </select>
          </div>

          {/* Volume Control */}
          <div>
            <label className="block text-sm font-medium mb-2">Voice Volume</label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.voice.volume}
              onChange={e => handleVoiceSettingsChange('volume', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* AI Model Settings */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">AI Model Settings</h3>
        <div className="bg-background-primary rounded-lg p-4 space-y-4">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">OpenRouter Model</label>
            <select
              className="w-full bg-background-secondary text-text px-4 py-2 rounded-lg"
              value={settings.ai.model}
              onChange={e => handleAISettingsChange('model', e.target.value)}
            >
              <option value="anthropic/claude-2">Claude 2</option>
              <option value="anthropic/claude-instant">Claude Instant</option>
              <option value="meta-llama/llama-2">Llama 2</option>
            </select>
          </div>

          {/* Response Style */}
          <div>
            <label className="block text-sm font-medium mb-2">Response Style</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="style"
                  value="concise"
                  checked={settings.ai.responseStyle === 'concise'}
                  onChange={e => handleAISettingsChange('responseStyle', e.target.value as 'concise')}
                />
                <span>Concise - Brief, to-the-point feedback</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="style"
                  value="detailed"
                  checked={settings.ai.responseStyle === 'detailed'}
                  onChange={e => handleAISettingsChange('responseStyle', e.target.value as 'detailed')}
                />
                <span>Detailed - In-depth analysis and suggestions</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="style"
                  value="coaching"
                  checked={settings.ai.responseStyle === 'coaching'}
                  onChange={e => handleAISettingsChange('responseStyle', e.target.value as 'coaching')}
                />
                <span>Coaching - Encouraging, educational feedback</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Settings */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Dashboard Settings</h3>
        <div className="bg-background-primary rounded-lg p-4 space-y-4">
          {/* Display Preferences */}
          <div>
            <label className="block text-sm font-medium mb-2">Display Preferences</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.display.showWinLossStreak}
                  onChange={e => handleDisplaySettingsChange('showWinLossStreak', e.target.checked)}
                />
                <span>Show win/loss streak</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.display.showPerformanceTrends}
                  onChange={e => handleDisplaySettingsChange('showPerformanceTrends', e.target.checked)}
                />
                <span>Show performance trends</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.display.showMatchDetails}
                  onChange={e => handleDisplaySettingsChange('showMatchDetails', e.target.checked)}
                />
                <span>Show match details in overlay</span>
              </label>
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <label className="block text-sm font-medium mb-2">Notifications</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.performanceMilestones}
                  onChange={e => handleNotificationSettingsChange('performanceMilestones', e.target.checked)}
                />
                <span>Performance milestones</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.matchAnalysis}
                  onChange={e => handleNotificationSettingsChange('matchAnalysis', e.target.checked)}
                />
                <span>Match analysis ready</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.notifications.personalRecords}
                  onChange={e => handleNotificationSettingsChange('personalRecords', e.target.checked)}
                />
                <span>New personal records</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}; 