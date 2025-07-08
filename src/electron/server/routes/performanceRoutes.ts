import express from 'express';
import {
  getOverview,
  getMapStats,
  getWeaponStats,
  getMatchHistory,
  getSettings,
  updateSettings
} from '../controllers/performanceController.js';

const router = express.Router();

// Performance overview
router.get('/overview', getOverview);

// Map stats
router.get('/maps', getMapStats);
router.get('/maps/:map', getMapStats);

// Weapon stats
router.get('/weapons', getWeaponStats);

// Match history
router.get('/matches', getMatchHistory);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export const performanceRoutes = router; 