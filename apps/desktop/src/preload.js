"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rohub", {
  version: "0.2.0-desktop-preview",
  isElectron: true,
  getAppInfo: () => ipcRenderer.invoke("rohub:get-app-info"),
  selectProjectFile: () => ipcRenderer.invoke("rohub:select-project-file"),
  onMenuAction: (handler) => {
    if (typeof handler !== "function") return () => {};

    const listener = (_event, action) => handler(action);
    ipcRenderer.on("rohub:menu-action", listener);
    return () => ipcRenderer.removeListener("rohub:menu-action", listener);
  },
  onServiceLog: (handler) => {
    if (typeof handler !== "function") return () => {};

    const listener = (_event, message) => handler(message);
    ipcRenderer.on("rohub:service-log", listener);
    return () => ipcRenderer.removeListener("rohub:service-log", listener);
  },
});
