"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let electron;

try {
  electron = require("electron");
} catch {
  console.error("Electron is not installed. Install electron, then run `npm run desktop`.");
}

const mainWindowState = {
  window: null,
};

const managedServices = [];

function sendMenuAction(action) {
  if (!mainWindowState.window || mainWindowState.window.isDestroyed()) return;
  mainWindowState.window.webContents.send("rohub:menu-action", action);
}

function sendServiceLog(message) {
  if (!mainWindowState.window || mainWindowState.window.isDestroyed()) return;
  mainWindowState.window.webContents.send("rohub:service-log", message);
}

function projectRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

function scriptPath(name) {
  return path.join(projectRoot(), name);
}

function startManagedService(name, script, args, env) {
  if (!fs.existsSync(script)) {
    sendServiceLog(`${name} script not found: ${script}`);
    return null;
  }

  const service = childProcess.spawn(process.execPath, [script, ...args], {
    cwd: projectRoot(),
    windowsHide: true,
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
      ROHUB_MANAGED_SERVICE: name,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  managedServices.push(service);
  sendServiceLog(`${name} starting on ${env.HOST || "127.0.0.1"}:${env.PORT}`);

  service.stdout.on("data", (chunk) => {
    sendServiceLog(`${name}: ${String(chunk).trim()}`);
  });

  service.stderr.on("data", (chunk) => {
    sendServiceLog(`${name}: ${String(chunk).trim()}`);
  });

  service.on("exit", (code) => {
    if (code === 0 || code === null) return;
    sendServiceLog(`${name} stopped with code ${code}. If the port is already in use, an existing service may be running.`);
  });

  return service;
}

function startBundledServices() {
  if (!electron) return;

  const { app } = electron;
  const dataDir = path.join(app.getPath("userData"), "central-data");
  fs.mkdirSync(dataDir, { recursive: true });

  startManagedService("central-server", scriptPath("central-server.js"), [], {
    HOST: "127.0.0.1",
    PORT: "7070",
    DATA_DIR: dataDir,
  });

  startManagedService("local-agent", scriptPath("local-agent.js"), ["serve"], {
    HOST: "127.0.0.1",
    PORT: "8787",
  });
}

function stopManagedServices() {
  for (const service of managedServices.splice(0)) {
    if (!service.killed) service.kill();
  }
}

function createApplicationMenu() {
  const { Menu, app } = electron;

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Select Roblox File",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("select-file"),
        },
        { type: "separator" },
        {
          label: "Save Config",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save-config"),
        },
        { type: "separator" },
        {
          label: process.platform === "darwin" ? "Close Window" : "Exit",
          accelerator: process.platform === "darwin" ? "CmdOrCtrl+W" : "Alt+F4",
          click: () => {
            if (process.platform === "darwin" && mainWindowState.window) {
              mainWindowState.window.close();
              return;
            }
            app.quit();
          },
        },
      ],
    },
    {
      label: "Sync",
      submenu: [
        {
          label: "Status",
          accelerator: "CmdOrCtrl+R",
          click: () => sendMenuAction("status"),
        },
        {
          label: "Push Local",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => sendMenuAction("push"),
        },
        {
          label: "Pull Remote",
          accelerator: "CmdOrCtrl+Shift+L",
          click: () => sendMenuAction("pull"),
        },
        {
          label: "Safe Sync",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("sync"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  const { ipcMain, dialog, app } = electron;

  ipcMain.handle("rohub:select-project-file", async () => {
    const result = await dialog.showOpenDialog(mainWindowState.window, {
      title: "Select Roblox project file",
      properties: ["openFile"],
      filters: [
        { name: "Roblox Places", extensions: ["rbxl", "rbxlx"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePath: "" };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle("rohub:get-app-info", () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  }));
}

function createMainWindow() {
  const { BrowserWindow } = electron;

  const win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    title: "Rohub",
    backgroundColor: "#f5f7fa",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindowState.window = win;

  win.once("ready-to-show", () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
  return win;
}

function boot() {
  if (!electron) return;

  const { app, BrowserWindow } = electron;

  app.setName("Rohub");
  app.whenReady().then(() => {
    registerIpc();
    createApplicationMenu();
    createMainWindow();
    startBundledServices();
  });

  app.on("before-quit", stopManagedServices);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

boot();

module.exports = {
  createApplicationMenu,
  createMainWindow,
  registerIpc,
};
