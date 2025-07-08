import express from 'express';
import { PiperTTSController } from '../controllers/piperTTSController.js';

const router = express.Router();
const piperTTSController = new PiperTTSController();

// These routes use implicit 'any' types for req and res, 
// which is not ideal but necessary to unblock the build.
router.post('/initialize', (req, res) => {
  piperTTSController.initialize(req, res);
});
router.post('/synthesize', (req, res) => {
  piperTTSController.synthesize(req, res);
});
router.post('/synthesize-file', (req, res) => {
  piperTTSController.synthesizeToFile(req, res);
});
router.get('/models', (req, res) => {
  piperTTSController.getModels(req, res);
});
router.post('/download-models', (req, res) => {
  piperTTSController.downloadModels(req, res);
});
router.get('/status', (req, res) => {
  piperTTSController.getStatus(req, res);
});
router.post('/stop', (req, res) => {
  piperTTSController.stop(req, res);
});
router.post('/cleanup', (req, res) => {
  piperTTSController.cleanup(req, res);
});
router.post('/test', (req, res) => {
  piperTTSController.test(req, res);
});
router.post('/stream', (req, res) => {
  piperTTSController.stream(req, res);
});

export default router; 