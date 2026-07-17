const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rohub", {
  version: "0.2.0-desktop-preview",
});