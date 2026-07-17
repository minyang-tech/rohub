#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { URL } = require("url");

const { calculateSyncState, SYNC_STATES } = require("./packages/core/src/sync-status");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const LOCAL_AGENT_TOKEN = process.env.LOCAL_AGENT_TOKEN || "";
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 80 * 1024 * 1024);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function md5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function gzipBase64(bytes) {
  return zlib.gzipSync(bytes).toString("base64");
}

function gunzipBase64(value) {
  return zlib.gunzipSync(Buffer.from(value, "base64"));
}

function safeChannelName(channel) {
  if (typeof channel !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(channel)) {
    throw httpError(400, "channel must be 1-64 chars: letters, numbers, dot, underscore, hyphen");
  }
  return channel;
}

function normalizeFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw httpError(400, "filePath is required");
  }
  return path.resolve(filePath.trim());
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function stateFilePath(filePath) {
  return `${filePath}.rohub-state.json`;
}

function readLocalState(filePath) {
  const statePath = stateFilePath(filePath);
  if (!fileExists(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writeLocalState(filePath, state) {
  const statePath = stateFilePath(filePath);
  ensureParentDir(statePath);
  fs.writeFileSync(statePath, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  return statePath;
}

function getLocalFileInfo(filePath) {
  if (!fileExists(filePath)) {
    return { exists: false, filePath, fileName: path.basename(filePath), md5: null, size: 0, updatedAt: null };
  }
  const bytes = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);
  return {
    exists: true,
    filePath,
    fileName: path.basename(filePath),
    md5: md5(bytes),
    size: bytes.length,
    updatedAt: stats.mtime.toISOString(),
  };
}

function writeServerFile(filePath, serverFile, makeBackup) {
  const bytes = gunzipBase64(serverFile.gzipBase64);
  let backupPath = null;
  ensureParentDir(filePath);
  if (makeBackup && fileExists(filePath)) {
    backupPath = `${filePath}.${timestampForFile()}.bak`;
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, bytes);
  return {
    filePath,
    backupPath,
    md5: md5(bytes),
    size: bytes.length,
    serverFileName: serverFile.fileName,
  };
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  if (origin !== "null" && !localhostOrigin) return;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
}

function sendEmpty(res, status) {
  res.writeHead(status, { "cache-control": "no-store" });
  res.end();
}

function sendJson(res, status, payload) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_JSON_BYTES) {
        reject(httpError(413, "request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(httpError(400, "invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function requestJson(method, targetUrl, body, token) {
  const url = new URL(targetUrl);
  const transport = url.protocol === "https:" ? https : http;
  const encodedBody = body ? Buffer.from(JSON.stringify(body), "utf8") : null;
  const headers = { accept: "application/json" };
  if (encodedBody) {
    headers["content-type"] = "application/json; charset=utf-8";
    headers["content-length"] = encodedBody.length;
  }
  if (token) headers.authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            return reject(httpError(502, `central server returned non-JSON response (${res.statusCode})`));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(httpError(res.statusCode, parsed.error || `central server error ${res.statusCode}`));
          }
          resolve(parsed);
        });
      }
    );
    req.on("error", (err) => reject(httpError(502, `central server request failed: ${err.message}`)));
    if (encodedBody) req.write(encodedBody);
    req.end();
  });
}

function joinCentral(centralUrl, route) {
  const base = new URL(centralUrl);
  const normalizedBase = base.pathname.replace(/\/+$/, "");
  base.pathname = `${normalizedBase}${route}`;
  base.search = "";
  return base.toString();
}

function normalizeOptions(options) {
  const centralUrl = options.centralUrl || "http://127.0.0.1:7070";
  const centralToken = options.centralToken || "";
  const channel = safeChannelName(options.channel || "main");
  const filePath = normalizeFilePath(options.filePath || path.join(process.cwd(), `${channel}.rbxlx`));
  return { centralUrl, centralToken, channel, filePath, fileName: path.basename(filePath) };
}

function recommendedAction(state) {
  switch (state) {
    case SYNC_STATES.CLEAN:
      return "none";
    case SYNC_STATES.LOCAL_AHEAD:
    case SYNC_STATES.MISSING_REMOTE:
      return "push";
    case SYNC_STATES.REMOTE_AHEAD:
    case SYNC_STATES.MISSING_LOCAL:
      return "pull";
    case SYNC_STATES.NO_BASE:
      return "initialize";
    default:
      return "resolve-conflict";
  }
}

async function remoteStatus(options) {
  const { centralUrl, centralToken, channel } = options;
  return requestJson(
    "GET",
    joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/status`),
    null,
    centralToken
  );
}

async function statusOnce(options) {
  const normalized = normalizeOptions(options || {});
  const local = getLocalFileInfo(normalized.filePath);
  const remoteRaw = await remoteStatus(normalized);
  const remoteFile = remoteRaw.exists && remoteRaw.hasFile ? remoteRaw.file : null;
  const state = readLocalState(normalized.filePath);
  const baseHash = state && state.channel === normalized.channel ? state.baseHash || "" : "";
  const syncState = calculateSyncState({
    localHash: local.exists ? local.md5 : "",
    remoteHash: remoteFile ? remoteFile.md5 : "",
    baseHash,
  });

  return {
    ok: true,
    action: "status",
    channel: normalized.channel,
    centralUrl: normalized.centralUrl,
    filePath: normalized.filePath,
    state: syncState,
    recommendedAction: recommendedAction(syncState),
    baseHash,
    stateFilePath: stateFilePath(normalized.filePath),
    local,
    remote: {
      exists: Boolean(remoteRaw.exists),
      hasFile: Boolean(remoteRaw.hasFile),
      file: remoteFile,
    },
  };
}

function ensurePushAllowed(status, force) {
  if (!status.local.exists) throw httpError(404, "local file does not exist; nothing to push");
  if (!force && (status.state === SYNC_STATES.REMOTE_AHEAD || status.state === SYNC_STATES.DIVERGED)) {
    throw httpError(409, `push blocked because sync state is ${status.state}; pull or resolve conflict first`);
  }
}

function ensurePullAllowed(status, force) {
  if (!status.remote.exists || !status.remote.hasFile) throw httpError(404, "remote channel has no file; nothing to pull");
  if (!force && (status.state === SYNC_STATES.LOCAL_AHEAD || status.state === SYNC_STATES.DIVERGED)) {
    throw httpError(409, `pull blocked because sync state is ${status.state}; push or resolve conflict first`);
  }
}

async function pushOnce(options) {
  const normalized = normalizeOptions(options || {});
  const force = Boolean(options && options.force);
  const status = await statusOnce(normalized);
  ensurePushAllowed(status, force);

  if (status.state === SYNC_STATES.CLEAN && !force) {
    return { ...status, action: "already-in-sync" };
  }

  const bytes = fs.readFileSync(normalized.filePath);
  const upload = await requestJson(
    "POST",
    joinCentral(normalized.centralUrl, `/v1/channels/${encodeURIComponent(normalized.channel)}/file`),
    { fileName: normalized.fileName, gzipBase64: gzipBase64(bytes) },
    normalized.centralToken
  );
  const baseHash = upload.meta.md5;
  const statePath = writeLocalState(normalized.filePath, {
    schemaVersion: 1,
    channel: normalized.channel,
    centralUrl: normalized.centralUrl,
    filePath: normalized.filePath,
    baseHash,
    lastAction: "push",
    lastSyncAt: new Date().toISOString(),
  });

  return {
    ok: true,
    action: status.remote.exists ? "pushed-local-file" : "created-remote-channel-pushed-local-file",
    channel: normalized.channel,
    filePath: normalized.filePath,
    stateBefore: status.state,
    stateAfter: SYNC_STATES.CLEAN,
    localMd5: md5(bytes),
    serverMd5: baseHash,
    size: bytes.length,
    stateFilePath: statePath,
  };
}

async function pullOnce(options) {
  const normalized = normalizeOptions(options || {});
  const force = Boolean(options && options.force);
  const status = await statusOnce(normalized);
  ensurePullAllowed(status, force);

  if (status.state === SYNC_STATES.CLEAN && !force) {
    return { ...status, action: "already-in-sync" };
  }

  const downloaded = await requestJson(
    "GET",
    joinCentral(normalized.centralUrl, `/v1/channels/${encodeURIComponent(normalized.channel)}/file`),
    null,
    normalized.centralToken
  );
  const written = writeServerFile(normalized.filePath, downloaded.file, status.local.exists);
  const statePath = writeLocalState(normalized.filePath, {
    schemaVersion: 1,
    channel: normalized.channel,
    centralUrl: normalized.centralUrl,
    filePath: normalized.filePath,
    baseHash: downloaded.file.md5,
    lastAction: "pull",
    lastSyncAt: new Date().toISOString(),
  });

  return {
    ok: true,
    action: status.local.exists ? "pulled-remote-file" : "downloaded-remote-file",
    channel: normalized.channel,
    stateBefore: status.state,
    stateAfter: SYNC_STATES.CLEAN,
    serverMd5: downloaded.file.md5,
    stateFilePath: statePath,
    ...written,
  };
}

async function createDefaultAndPull(options) {
  const normalized = normalizeOptions(options || {});
  const created = await requestJson(
    "POST",
    joinCentral(normalized.centralUrl, `/v1/channels/${encodeURIComponent(normalized.channel)}/default`),
    { fileName: normalized.fileName },
    normalized.centralToken
  );
  const written = writeServerFile(normalized.filePath, created.file, false);
  const statePath = writeLocalState(normalized.filePath, {
    schemaVersion: 1,
    channel: normalized.channel,
    centralUrl: normalized.centralUrl,
    filePath: normalized.filePath,
    baseHash: created.file.md5,
    lastAction: "create-default",
    lastSyncAt: new Date().toISOString(),
  });
  return {
    ok: true,
    action: "created-channel-downloaded-default-file",
    channel: normalized.channel,
    stateAfter: SYNC_STATES.CLEAN,
    serverMd5: created.file.md5,
    stateFilePath: statePath,
    ...written,
  };
}

async function syncOnce(options) {
  const status = await statusOnce(options || {});
  switch (status.state) {
    case SYNC_STATES.CLEAN:
      return { ...status, action: "already-in-sync" };
    case SYNC_STATES.LOCAL_AHEAD:
    case SYNC_STATES.MISSING_REMOTE:
      return pushOnce(options || {});
    case SYNC_STATES.REMOTE_AHEAD:
    case SYNC_STATES.MISSING_LOCAL:
      return pullOnce(options || {});
    case SYNC_STATES.NO_BASE:
      if (status.local.exists && !status.remote.hasFile) return pushOnce(options || {});
      if (!status.local.exists && !status.remote.hasFile) return createDefaultAndPull(options || {});
      throw httpError(409, "sync blocked because both local and remote exist without a known base; choose push --force or pull --force explicitly");
    default:
      throw httpError(409, `sync blocked because sync state is ${status.state}; resolve conflict first`);
  }
}

function requireAuth(req) {
  if (!LOCAL_AGENT_TOKEN) return;
  const expected = `Bearer ${LOCAL_AGENT_TOKEN}`;
  if (req.headers.authorization !== expected) {
    throw httpError(401, "missing or invalid local agent token");
  }
}

async function route(req, res) {
  applyCors(req, res);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    sendEmpty(res, 204);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "rbxl-channel-local-agent" });
    return;
  }

  requireAuth(req);

  if (req.method === "POST" && url.pathname === "/status") {
    const body = await readJson(req);
    sendJson(res, 200, await statusOnce(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/push") {
    const body = await readJson(req);
    sendJson(res, 200, await pushOnce(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/pull") {
    const body = await readJson(req);
    sendJson(res, 200, await pullOnce(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/sync") {
    const body = await readJson(req);
    sendJson(res, 200, await syncOnce(body));
    return;
  }

  throw httpError(404, "not found");
}

function serve() {
  const server = http.createServer((req, res) => {
    route(req, res).catch((err) => {
      const status = err.status || 500;
      sendJson(res, status, { ok: false, error: err.message || "internal server error" });
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`RBXL local agent listening on http://${HOST}:${PORT}`);
    if (LOCAL_AGENT_TOKEN) console.log("Local agent token auth: enabled");
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function optionsFromArgs(args) {
  return {
    centralUrl: args.central || args.centralUrl,
    centralToken: args.centralToken || process.env.CENTRAL_TOKEN || "",
    channel: args.channel,
    filePath: args.file || args.filePath,
    force: Boolean(args.force),
  };
}

async function main() {
  const command = process.argv[2] || "serve";
  if (["status", "push", "pull", "sync"].includes(command)) {
    const args = parseArgs(process.argv.slice(3));
    const options = optionsFromArgs(args);
    const handlers = { status: statusOnce, push: pushOnce, pull: pullOnce, sync: syncOnce };
    const result = await handlers[command](options);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === "serve") {
    serve();
    return;
  }
  console.error("Usage:");
  console.error("  node local-agent.js serve");
  console.error("  node local-agent.js status --central http://127.0.0.1:7070 --channel main --file ./main.rbxlx");
  console.error("  node local-agent.js push --central http://127.0.0.1:7070 --channel main --file ./main.rbxlx [--force]");
  console.error("  node local-agent.js pull --central http://127.0.0.1:7070 --channel main --file ./main.rbxlx [--force]");
  console.error("  node local-agent.js sync --central http://127.0.0.1:7070 --channel main --file ./main.rbxlx");
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
