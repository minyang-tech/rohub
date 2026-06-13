#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { URL } = require("url");

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
  const headers = {
    accept: "application/json",
  };
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

async function syncOnce(options) {
  const centralUrl = options.centralUrl || "http://127.0.0.1:7070";
  const centralToken = options.centralToken || "";
  const channel = safeChannelName(options.channel || "main");
  const filePath = normalizeFilePath(options.filePath || path.join(process.cwd(), `${channel}.rbxlx`));
  const fileName = path.basename(filePath);

  const handshake = await requestJson("POST", joinCentral(centralUrl, "/v1/handshake"), { channel }, centralToken);
  const localExists = fileExists(filePath);

  if (!handshake.exists) {
    if (localExists) {
      const bytes = fs.readFileSync(filePath);
      const upload = await requestJson(
        "POST",
        joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/file`),
        { fileName, gzipBase64: gzipBase64(bytes) },
        centralToken
      );
      return {
        ok: true,
        action: "created-channel-uploaded-local-file",
        channel,
        channelExisted: false,
        filePath,
        localMd5: md5(bytes),
        serverMd5: upload.meta.md5,
        size: bytes.length,
      };
    }

    const created = await requestJson(
      "POST",
      joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/default`),
      { fileName },
      centralToken
    );
    const written = writeServerFile(filePath, created.file, false);
    return {
      ok: true,
      action: "created-channel-downloaded-default-file",
      channel,
      channelExisted: false,
      ...written,
    };
  }

  if (!localExists) {
    let downloaded;
    try {
      downloaded = await requestJson(
        "GET",
        joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/file`),
        null,
        centralToken
      );
    } catch (err) {
      if (err.status !== 404) throw err;
      downloaded = await requestJson(
        "POST",
        joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/default`),
        { fileName },
        centralToken
      );
    }
    const written = writeServerFile(filePath, downloaded.file, false);
    return {
      ok: true,
      action: "downloaded-server-file",
      channel,
      channelExisted: true,
      ...written,
    };
  }

  const localBytes = fs.readFileSync(filePath);
  const localMd5 = md5(localBytes);
  const compared = await requestJson(
    "POST",
    joinCentral(centralUrl, `/v1/channels/${encodeURIComponent(channel)}/compare`),
    { md5: localMd5 },
    centralToken
  );

  if (compared.same) {
    return {
      ok: true,
      action: "already-in-sync",
      channel,
      channelExisted: true,
      filePath,
      localMd5,
      serverMd5: compared.md5,
      size: localBytes.length,
    };
  }

  const written = writeServerFile(filePath, compared.file, true);
  return {
    ok: true,
    action: "replaced-local-with-server-file",
    channel,
    channelExisted: true,
    localMd5Before: localMd5,
    serverMd5: compared.file.md5,
    ...written,
  };
}

function requireAuth(req) {
  if (!LOCAL_AGENT_TOKEN) return;
  const expected = `Bearer ${LOCAL_AGENT_TOKEN}`;
  if (req.headers.authorization !== expected) {
    throw httpError(401, "missing or invalid local agent token");
  }
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "rbxl-channel-local-agent" });
    return;
  }

  requireAuth(req);

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

async function main() {
  const command = process.argv[2] || "serve";
  if (command === "sync") {
    const args = parseArgs(process.argv.slice(3));
    const result = await syncOnce({
      centralUrl: args.central || args.centralUrl,
      centralToken: args.centralToken || process.env.CENTRAL_TOKEN || "",
      channel: args.channel,
      filePath: args.file || args.filePath,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === "serve") {
    serve();
    return;
  }
  console.error("Usage:");
  console.error("  node local-agent.js serve");
  console.error("  node local-agent.js sync --central http://127.0.0.1:7070 --channel main --file ./main.rbxlx");
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
