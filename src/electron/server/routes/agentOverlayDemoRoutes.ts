import express from 'express';
import { AgentOverlayDemoController } from '../controllers/agentOverlayDemoController.js';

const router = express.Router();
const agentDemoController = new AgentOverlayDemoController();

// Get current demo status and agent status
router.get('/status', (req, res) => {
  agentDemoController.getStatus(req, res);
});

// Get API help and documentation
router.get('/help', (req, res) => {
  agentDemoController.getHelp(req, res);
});

// Start the automated demonstration loop
router.post('/start', (req, res) => {
  agentDemoController.startDemo(req, res);
});

// Stop the automated demonstration loop
router.post('/stop', (req, res) => {
  agentDemoController.stopDemo(req, res);
});

// Trigger a specific demo scenario
router.post('/scenario', (req, res) => {
  agentDemoController.triggerScenario(req, res);
});

// Manually update agent status
router.post('/status', (req, res) => {
  agentDemoController.updateStatus(req, res);
});

// Simulate audio event
router.post('/audio', (req, res) => {
  agentDemoController.simulateAudio(req, res);
});

export default router; 