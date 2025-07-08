import { app, BrowserWindow, Menu } from "electron";
import { isDev } from "./helpers/util.js";

export function createMenu(mainWindow: BrowserWindow) {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        // MacOS makes first option a default name
        label: process.platform === "darwin" ? undefined : "CS2 Coach AI",
        type: "submenu",
        submenu: [
          {
            label: "Quit",
            click: app.quit,
          },
          // {
          //   label: "DevTools",
          //   click: () => {
          //     mainWindow.webContents.openDevTools();
          //   },
          //   visible: isDev(),
          // },
        ],
      },
      {
        label: "DevTools",
        click: () => {
          mainWindow.webContents.openDevTools();
        },
        visible: isDev(),
      },
    ]),
  );
}
