import { updateAgentStatus, simulateAudioEvent } from '../sockets/socket.js';
import { PiperTTSService } from './piperTTSServices.js';

export class AgentOverlayDemoService {
  private static instance: AgentOverlayDemoService;
  private piperTTS: PiperTTSService;
  private demoInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {
    this.piperTTS = PiperTTSService.getInstance();
  }

  public static getInstance(): AgentOverlayDemoService {
    if (!AgentOverlayDemoService.instance) {
      AgentOverlayDemoService.instance = new AgentOverlayDemoService();
    }
    return AgentOverlayDemoService.instance;
  }

  /**
   * Start a demonstration loop that cycles through different agent states
   */
  public async startDemo(): Promise<void> {
    if (this.isRunning) {
      console.log('Agent demo is already running');
      return;
    }

    console.log('Starting Agent Overlay demonstration...');
    this.isRunning = true;

    // Initialize TTS if available
    try {
      await this.piperTTS.initialize();
      console.log('TTS initialized for agent demo');
    } catch (error) {
      console.warn('TTS not available for demo:', error);
    }

    // Start the demo cycle
    this.runDemoCycle();
  }

  /**
   * Stop the demonstration loop
   */
  public stopDemo(): void {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.isRunning = false;
    updateAgentStatus('idle', 'Demo stopped - Agent ready');
    console.log('Agent demo stopped');
  }

  /**
   * Run a single demonstration cycle
   */
  private async runDemoCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Step 1: Analyzing state
      updateAgentStatus('analyzing', 'Analyzing current game situation...', 'Game State Analysis');
      await this.delay(3000);

      if (!this.isRunning) return;

      // Step 2: Provide feedback with TTS
      updateAgentStatus('feedback', 'Providing tactical advice...', 'Strategy Generation');
      await this.playTTSFeedback('Consider checking the bomb site A. The enemy might be rotating from B.');
      await this.delay(2000);

      if (!this.isRunning) return;

      // Step 3: Awaiting user input
      updateAgentStatus('awaiting', 'Waiting for your decision...', 'User Input Required');
      await this.delay(4000);

      if (!this.isRunning) return;

      // Step 4: Analysis result
      updateAgentStatus('analyzing', 'Processing your strategy...', 'Strategy Evaluation');
      await this.delay(2500);

      if (!this.isRunning) return;

      // Step 5: Final feedback
      updateAgentStatus('feedback', 'Excellent positioning! Consider using utility.', 'Positive Reinforcement');
      await this.playTTSFeedback('Great job! Your positioning is excellent. Consider using your utility to secure the site.');
      await this.delay(2000);

      if (!this.isRunning) return;

      // Step 6: Return to idle
      updateAgentStatus('idle', 'Ready for next round analysis', 'Standby Mode');
      await this.delay(5000);

      // Schedule next cycle
      if (this.isRunning) {
        setTimeout(() => this.runDemoCycle(), 1000);
      }

    } catch (error) {
      console.error('Error in demo cycle:', error);
      updateAgentStatus('error', `Demo error: ${error}`, 'Error Recovery');
      await this.delay(3000);
      
      if (this.isRunning) {
        updateAgentStatus('idle', 'Demo restarting...', 'Recovery Mode');
        setTimeout(() => this.runDemoCycle(), 2000);
      }
    }
  }

  /**
   * Play TTS feedback if available, otherwise simulate audio
   */
  private async playTTSFeedback(message: string): Promise<void> {
    try {
      // Try to use real TTS
      const audioBuffer = await this.piperTTS.textToSpeech(message);
      
      if (audioBuffer && audioBuffer.length > 0) {
        console.log(`Playing real TTS: "${message}"`);
        // In a real implementation, you would play the audio buffer
        // For now, we'll simulate the audio duration
        const estimatedDuration = message.length * 100; // ~100ms per character
        simulateAudioEvent(message);
        await this.delay(Math.min(estimatedDuration, 5000)); // Max 5 seconds
      } else {
        throw new Error('TTS returned empty buffer');
      }
    } catch (error) {
      console.log(`Simulating TTS audio: "${message}"`);
      // Fallback to simulated audio
      simulateAudioEvent(message);
      await this.delay(3000); // Simulate 3 second audio
    }
  }

  /**
   * Manually trigger different demo scenarios
   */
  public async triggerScenario(scenario: string): Promise<void> {
    console.log(`Triggering scenario: ${scenario}`);

    switch (scenario) {
      case 'analysis':
        updateAgentStatus('analyzing', 'Analyzing enemy movements...', 'Tactical Analysis');
        await this.delay(3000);
        updateAgentStatus('idle', 'Analysis complete', 'Ready');
        break;

      case 'feedback':
        updateAgentStatus('feedback', 'Providing strategic advice...', 'Coaching Mode');
        await this.playTTSFeedback('Try to control the middle area of the map. It gives you better rotation options.');
        updateAgentStatus('idle', 'Feedback delivered', 'Ready');
        break;

      case 'error':
        updateAgentStatus('error', 'Unable to connect to game state', 'Connection Error');
        await this.delay(3000);
        updateAgentStatus('idle', 'Connection restored', 'Ready');
        break;

      case 'awaiting':
        updateAgentStatus('awaiting', 'Choose your strategy: Rush A or play defaults?', 'Strategy Selection');
        await this.delay(5000);
        updateAgentStatus('idle', 'Strategy received', 'Ready');
        break;

      default:
        updateAgentStatus('idle', 'Demo scenario ready', 'Available Scenarios');
        console.log('Available scenarios: analysis, feedback, error, awaiting');
    }
  }

  /**
   * Get demo status
   */
  public getDemoStatus(): { isRunning: boolean; ttsAvailable: boolean } {
    return {
      isRunning: this.isRunning,
      ttsAvailable: this.piperTTS.getIsInitialized()
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 