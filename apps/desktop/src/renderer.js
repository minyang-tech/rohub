const STORAGE_KEY = "rohub.desktop.config.v1";
const fields = ["localAgentUrl", "centralUrl", "channel", "filePath", "localAgentToken", "centralToken"];

function element(id) {
  return document.getElementById(id);
}

function nowText() {
  return new Date().toLocaleTimeString();
}

function appendLog(message) {
  const log = element("activityLog");
  log.textContent = `[${nowText()}] ${message}\n${log.textContent}`;
}

function readConfig() {
  const config = {};
  for (const id of fields) config[id] = element(id).value.trim();
  config.force = element("force").checked;
  return config;
}

function saveConfig() {
  const config = readConfig();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  appendLog("Configuration saved locally.");
}

function loadConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    for (const id of fields) {
      if (typeof config[id] === "string" && config[id]) element(id).value = config[id];
    }
    if (typeof config.force === "boolean") element("force").checked = config.force;
  } catch {
    appendLog("Stored configuration was invalid and has been ignored.");
  }
}

function agentUrl(config, action) {
  return `${config.localAgentUrl.replace(/\/+$/, "")}/${action}`;
}

function requestBody(config) {
  return {
    centralUrl: config.centralUrl,
    centralToken: config.centralToken,
    channel: config.channel,
    filePath: config.filePath,
    force: Boolean(config.force),
  };
}

function safeBodyForLog(body) {
  return { ...body, centralToken: body.centralToken ? "***" : "" };
}

async function callAgent(action) {
  const config = readConfig();
  if (!config.localAgentUrl || !config.centralUrl || !config.channel || !config.filePath) {
    throw new Error("Local agent URL, central URL, channel, and file path are required.");
  }

  const body = requestBody(config);
  const headers = { "content-type": "application/json" };
  if (config.localAgentToken) headers.authorization = `Bearer ${config.localAgentToken}`;

  appendLog(`${action.toUpperCase()} -> ${agentUrl(config, action)} ${JSON.stringify(safeBodyForLog(body))}`);
  const response = await fetch(agentUrl(config, action), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`local-agent returned non-JSON response: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(parsed.error || `HTTP ${response.status}`);
  return parsed;
}

function stateClass(state) {
  return `state-pill state-${String(state || "unknown").replace(/[^a-z0-9-]/gi, "-")}`;
}

function renderResult(result) {
  const state = result.stateAfter || result.state || "unknown";
  const pill = element("statePill");
  pill.textContent = state;
  pill.className = stateClass(state);
  element("recommendedAction").textContent = result.recommendedAction || result.action || "-";
  element("localHash").textContent = result.localMd5 || result.md5 || result.local?.md5 || "-";
  element("remoteHash").textContent = result.serverMd5 || result.remote?.file?.md5 || "-";
  element("rawResponse").textContent = JSON.stringify(result, null, 2);
}

async function runAction(action) {
  for (const button of document.querySelectorAll("button")) button.disabled = true;
  try {
    const result = await callAgent(action);
    renderResult(result);
    appendLog(`${action.toUpperCase()} completed: ${result.action || result.state || "ok"}`);
    if (action !== "status") saveConfig();
  } catch (error) {
    appendLog(`${action.toUpperCase()} failed: ${error.message}`);
    element("rawResponse").textContent = JSON.stringify({ ok: false, error: error.message }, null, 2);
  } finally {
    for (const button of document.querySelectorAll("button")) button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  element("saveConfig").addEventListener("click", saveConfig);
  for (const button of document.querySelectorAll("[data-action]")) {
    button.addEventListener("click", () => runAction(button.dataset.action));
  }
  appendLog(window.rohub ? `Electron bridge ready: ${window.rohub.version}` : "Browser preview mode ready.");
});