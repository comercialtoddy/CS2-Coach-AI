import express from "express";
import { teamRoutes } from "./teamRoutes.js";
import { playerRoutes } from "./playerRoutes.js";
import { coachRoutes } from "./coachRoutes.js";
import { matchRoutes } from "./matchRoutes.js";
import { settingsRoutes } from "./settingsRoutes.js";
import { trackerGGRoutes } from "./trackerGGRoutes.js";
import piperTTSRoutes from "./piperTTSRoutes.js";
import agentOverlayDemoRoutes from "./agentOverlayDemoRoutes.js";
import { openRouterRoutes } from "./openRouterRoutes.js";
import { dataRetrievalRoutes } from "./dataRetrievalRoutes.js";
import taskGenerationRoutes from "./taskGenerationRoutes.js";
import taskProgressRoutes from "./taskProgressRoutes.js";
import rewardAssignmentRoutes from "./rewardAssignmentRoutes.js";

const router = express.Router();

router.use("/teams", teamRoutes);
router.use("/players", playerRoutes);
router.use("/coaches", coachRoutes);
router.use("/matches", matchRoutes);
router.use("/settings", settingsRoutes);
router.use("/tracker-gg", trackerGGRoutes);
router.use("/piper-tts", piperTTSRoutes);
router.use("/agent-overlay-demo", agentOverlayDemoRoutes);
router.use("/openrouter", openRouterRoutes);
router.use("/data-retrieval", dataRetrievalRoutes);
router.use("/tasks", taskGenerationRoutes);
router.use("/progress", taskProgressRoutes);
router.use("/rewards", rewardAssignmentRoutes);

export default router;
export {
  teamRoutes,
  playerRoutes,
  coachRoutes,
  matchRoutes,
  settingsRoutes,
  trackerGGRoutes,
  piperTTSRoutes,
  agentOverlayDemoRoutes,
  openRouterRoutes,
  dataRetrievalRoutes,
  taskGenerationRoutes,
  taskProgressRoutes,
  rewardAssignmentRoutes
};
