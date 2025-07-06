import { Request, Response } from 'express';
import { AgentOverlayDemoService } from '../services/agentOverlayDemoService.js';
import { updateAgentStatus, simulateAudioEvent, getCurrentAgentStatus } from '../sockets/socket.js';

export class AgentOverlayDemoController {
  private demoService: AgentOverlayDemoService;

  constructor() {
    this.demoService = AgentOverlayDemoService.getInstance();
  }

  /**
   * Start the agent overlay demonstration
   * POST /api/agent-demo/start
   */
  async startDemo(req: Request, res: Response): Promise<void> {
    try {
      await this.demoService.startDemo();
      res.json({
        success: true,
        message: 'Agent overlay demonstration started',
        status: this.demoService.getDemoStatus()
      });
    } catch (error: any) {
      console.error('Failed to start agent demo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start demonstration',
        error: error.message
      });
    }
  }

  /**
   * Stop the agent overlay demonstration
   * POST /api/agent-demo/stop
   */
  stopDemo(req: Request, res: Response): void {
    try {
      this.demoService.stopDemo();
      res.json({
        success: true,
        message: 'Agent overlay demonstration stopped',
        status: this.demoService.getDemoStatus()
      });
    } catch (error: any) {
      console.error('Failed to stop agent demo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop demonstration',
        error: error.message
      });
    }
  }

  /**
   * Trigger a specific demo scenario
   * POST /api/agent-demo/scenario
   * Body: { scenario: 'analysis' | 'feedback' | 'error' | 'awaiting' }
   */
  async triggerScenario(req: Request, res: Response): Promise<void> {
    try {
      const { scenario } = req.body;

      if (!scenario || typeof scenario !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Scenario parameter is required',
          availableScenarios: ['analysis', 'feedback', 'error', 'awaiting']
        });
        return;
      }

      await this.demoService.triggerScenario(scenario);
      
      res.json({
        success: true,
        message: `Triggered scenario: ${scenario}`,
        scenario,
        currentStatus: getCurrentAgentStatus()
      });
    } catch (error: any) {
      console.error('Failed to trigger scenario:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger scenario',
        error: error.message
      });
    }
  }

  /**
   * Manually update agent status
   * POST /api/agent-demo/status
   * Body: { state: string, message?: string, action?: string }
   */
  updateStatus(req: Request, res: Response): void {
    try {
      const { state, message, action } = req.body;

      if (!state) {
        res.status(400).json({
          success: false,
          message: 'State parameter is required',
          validStates: ['idle', 'analyzing', 'awaiting', 'feedback', 'error']
        });
        return;
      }

      updateAgentStatus(state, message, action);

      res.json({
        success: true,
        message: 'Agent status updated',
        currentStatus: getCurrentAgentStatus()
      });
    } catch (error: any) {
      console.error('Failed to update agent status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update status',
        error: error.message
      });
    }
  }

  /**
   * Simulate audio event
   * POST /api/agent-demo/audio
   * Body: { message: string }
   */
  simulateAudio(req: Request, res: Response): void {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Message parameter is required for audio simulation'
        });
        return;
      }

      simulateAudioEvent(message);

      res.json({
        success: true,
        message: 'Audio simulation started',
        audioMessage: message,
        duration: '3 seconds (simulated)'
      });
    } catch (error: any) {
      console.error('Failed to simulate audio:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to simulate audio',
        error: error.message
      });
    }
  }

  /**
   * Get current demo status and agent status
   * GET /api/agent-demo/status
   */
  getStatus(req: Request, res: Response): void {
    try {
      const demoStatus = this.demoService.getDemoStatus();
      const agentStatus = getCurrentAgentStatus();

      res.json({
        success: true,
        demo: demoStatus,
        agent: agentStatus,
        endpoints: {
          start: 'POST /api/agent-demo/start',
          stop: 'POST /api/agent-demo/stop',
          scenario: 'POST /api/agent-demo/scenario',
          updateStatus: 'POST /api/agent-demo/status',
          simulateAudio: 'POST /api/agent-demo/audio'
        }
      });
    } catch (error: any) {
      console.error('Failed to get demo status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get status',
        error: error.message
      });
    }
  }

  /**
   * Get available demo scenarios and commands
   * GET /api/agent-demo/help
   */
  getHelp(req: Request, res: Response): void {
    res.json({
      success: true,
      message: 'Agent Overlay Demo API Help',
      endpoints: {
        'GET /api/agent-demo/status': 'Get current demo and agent status',
        'GET /api/agent-demo/help': 'Show this help information',
        'POST /api/agent-demo/start': 'Start the automated demo loop',
        'POST /api/agent-demo/stop': 'Stop the automated demo loop',
        'POST /api/agent-demo/scenario': 'Trigger specific scenario',
        'POST /api/agent-demo/status': 'Manually update agent status',
        'POST /api/agent-demo/audio': 'Simulate audio event'
      },
      scenarios: {
        'analysis': 'Show analyzing state for 3 seconds',
        'feedback': 'Show feedback state with TTS audio',
        'error': 'Show error state for 3 seconds',
        'awaiting': 'Show awaiting input state for 5 seconds'
      },
      agentStates: ['idle', 'analyzing', 'awaiting', 'feedback', 'error'],
      examples: {
        triggerAnalysis: {
          url: 'POST /api/agent-demo/scenario',
          body: { scenario: 'analysis' }
        },
        updateStatus: {
          url: 'POST /api/agent-demo/status',
          body: { state: 'analyzing', message: 'Custom analysis message', action: 'Custom Action' }
        },
        simulateAudio: {
          url: 'POST /api/agent-demo/audio',
          body: { message: 'This is a test audio message' }
        }
      }
    });
  }
} 