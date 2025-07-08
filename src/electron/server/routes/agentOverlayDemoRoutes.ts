import express from "express";
import { AgentOverlayDemoController } from "../controllers/agentOverlayDemoController.js";

const router = express.Router();
const agentDemoController = new AgentOverlayDemoController();

router.get('/status', (req, res) => {
  agentDemoController.getStatus(req, res);
});
router.get('/help', (req, res) => {
  agentDemoController.getHelp(req, res);
});
router.post('/start', (req, res) => {
  agentDemoController.startDemo(req, res);
});
router.post('/stop', (req, res) => {
  agentDemoController.stopDemo(req, res);
});
router.post('/scenario', (req, res) => {
  agentDemoController.triggerScenario(req, res);
});
router.post('/status', (req, res) => {
  agentDemoController.updateStatus(req, res);
});
router.post('/audio', (req, res) => {
  agentDemoController.simulateAudio(req, res);
});

export default router; 