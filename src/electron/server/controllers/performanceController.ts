import { Request, Response } from 'express';
import { performanceServices } from '../services/performanceServices.js';
import { asyncHandler } from '../helpers/asyncHandler.js';

// Get performance overview
export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await performanceServices.getOverview();
  res.json(data);
});

// Get map-specific stats
export const getMapStats = asyncHandler(async (req: Request, res: Response) => {
  const { map } = req.params;
  const data = await performanceServices.getMapStats(map);
  res.json(data);
});

// Get weapon stats
export const getWeaponStats = asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.query;
  const data = await performanceServices.getWeaponStats(type as string);
  res.json(data);
});

// Get match history
export const getMatchHistory = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', map, result } = req.query;
  const data = await performanceServices.getMatchHistory(
    parseInt(page as string),
    { map: map as string, result: result as 'win' | 'loss' }
  );
  res.json(data);
});

// Get performance settings
export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await performanceServices.getSettings();
  res.json(data);
});

// Update performance settings
export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = req.body;
  const data = await performanceServices.updateSettings(settings);
  res.json(data);
}); 