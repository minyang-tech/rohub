const path = require("node:path");

let app;
let BrowserWindow;

try {
  ({ app, BrowserWindow } = require("electron"));
} catch {
  console.log("Electron이 아직 설치되지 않았습니다. 현재 파일은 데스크톱 앱 뼈대입니다.");
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: "Rohub",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
  return win;
}

if (app) {
  app.whenReady().then(createMainWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

module.exports = { createMainWindow };