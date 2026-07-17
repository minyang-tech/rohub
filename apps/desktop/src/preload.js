const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rohub", {
  version: "0.1.0-skeleton",
  async getStatus() {
    return {
      ok: false,
      state: "no-project",
      message: "local-agent 연결은 다음 단계에서 구현합니다.",
    };
  },
});