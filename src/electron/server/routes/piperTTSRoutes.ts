import express from 'express';
import { PiperTTSController } from '../controllers/piperTTSController';

const router = express.Router();
const piperTTSController = new PiperTTSController();

// Initialize Piper TTS system
router.post('/initialize', (req, res) => {
  piperTTSController.initialize(req, res);
});

// Convert text to speech and return audio buffer
router.post('/synthesize', (req, res) => {
  piperTTSController.synthesize(req, res);
});

// Convert text to speech and save to file
router.post('/synthesize-file', (req, res) => {
  piperTTSController.synthesizeToFile(req, res);
});

// Get available voice models
router.get('/models', (req, res) => {
  piperTTSController.getModels(req, res);
});

// Download default voice models
router.post('/download-models', (req, res) => {
  piperTTSController.downloadModels(req, res);
});

// Get TTS service status
router.get('/status', (req, res) => {
  piperTTSController.getStatus(req, res);
});

// Stop current TTS process
router.post('/stop', (req, res) => {
  piperTTSController.stop(req, res);
});

// Cleanup TTS resources
router.post('/cleanup', (req, res) => {
  piperTTSController.cleanup(req, res);
});

// Test TTS with sample text
router.post('/test', (req, res) => {
  piperTTSController.test(req, res);
});

// Stream audio for real-time TTS
router.post('/stream', (req, res) => {
  piperTTSController.stream(req, res);
});

export default router; 