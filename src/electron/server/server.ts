import express, { Express } from "express";
import cors from "cors";
import http from "http";
import { initializeSocket } from "./sockets/socket.js";
import { readGameData } from "./sockets/GSI.js";
import {
  router as mainRouter,
  playerRoutes,
  teamRoutes,
  matchRoutes,
  coachRoutes,
  settingsRoutes,
  trackerGGRoutes,
  piperTTSRoutes,
  agentOverlayDemoRoutes,
  openRouterRoutes,
  dataRetrievalRoutes,
  performanceRoutes
} from "./routes/index.js";
import { BrowserWindow } from "electron";
import { ipcWebContentsSend } from "../helpers/util.js";
import { registerCoreDataRetrievalTools } from "./ai/tools/registerCoreDataRetrievalTools.js";
import { getHudPath, getUploadsPath } from "../helpers/index.js";
import path from "path";
import { ToolManager } from "./ai/ToolManager.js";

const port = process.env.PORT || "1349";

export const startServer = (mainWindow: BrowserWindow) => {
  const expressApp: Express = express();
  const server = http.createServer(expressApp);
  initializeSocket(server);
  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static(getHudPath()));

  /* Serve static files from the uploads directory */
  expressApp.use("/uploads", express.static(getUploadsPath()));

  /* Game Data */
  expressApp.post("/gsi", readGameData);

  /* Hud */
  expressApp.get("/hud", (_req, res) => {
    res.sendFile(path.join(getHudPath(), "index.html"));
  });

  /* Routes */
  expressApp.use(mainRouter);
  expressApp.use(playerRoutes);
  expressApp.use(teamRoutes);
  expressApp.use(matchRoutes);
  expressApp.use(coachRoutes);
  expressApp.use(settingsRoutes);
  expressApp.use("/tracker-gg", trackerGGRoutes);
  expressApp.use("/piper-tts", piperTTSRoutes);
  expressApp.use("/agent-demo", agentOverlayDemoRoutes);
  expressApp.use("/openrouter", openRouterRoutes);
  expressApp.use("/data-retrieval", dataRetrievalRoutes);
  expressApp.use("/performance", performanceRoutes);

  server.listen(port, async () => {
    console.log(`Server listening on port ${port}`);
    
    // Initialize AI Tool Manager
    const toolManager = new ToolManager();
    
    // Initialize Core Data Retrieval Tools
    try {
      await registerCoreDataRetrievalTools(toolManager);
    } catch (error) {
      console.error('Failed to initialize Core Data Retrieval Tools:', error);
      // Continue server startup even if tools fail to register
    }
  });

  ipcWebContentsSend(
    "startServer",
    mainWindow.webContents,
    "Server started on port",
  );

  return server;
};

export function shutDown(server: http.Server) {
  console.log("Received kill server signal, shutting down gracefully");
  server.close(() => {
    console.log("Closed out remaining connections");
    process.exit(0);
  });
}
