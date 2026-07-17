#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 7070);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "central-data"));
const CENTRAL_TOKEN = process.env.CENTRAL_TOKEN || "";
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 80 * 1024 * 1024);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function md5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function safeChannelName(channel) {
  if (typeof channel !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(channel)) {
    throw httpError(400, "channel must be 1-64 chars: letters, numbers, dot, underscore, hyphen");
  }
  return channel;
}

function safeFileName(fileName) {
  const name = path.basename(String(fileName || "default.rbxlx")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return name || "default.rbxlx";
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function channelPaths(channel) {
  const safe = safeChannelName(channel);
  const dir = path.join(DATA_DIR, "channels");
  return {
    dir,
    file: path.join(dir, `${safe}.bin`),
    meta: path.join(dir, `${safe}.json`),
  };
}

function loadMeta(channel) {
  const paths = channelPaths(channel);
  if (!fs.existsSync(paths.meta)) return null;
  return JSON.parse(fs.readFileSync(paths.meta, "utf8"));
}

function saveMeta(channel, meta) {
  const paths = channelPaths(channel);
  ensureDir(paths.dir);
  fs.writeFileSync(paths.meta, `${JSON.stringify(meta, null, 2)}\n`);
}

function saveChannelFile(channel, fileName, bytes) {
  const paths = channelPaths(channel);
  ensureDir(paths.dir);
  fs.writeFileSync(paths.file, bytes);
  const meta = {
    channel,
    fileName: safeFileName(fileName),
    md5: md5(bytes),
    size: bytes.length,
    updatedAt: new Date().toISOString(),
  };
  saveMeta(channel, meta);
  return meta;
}

function gzipBase64(bytes) {
  return zlib.gzipSync(bytes).toString("base64");
}

function gunzipBase64(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw httpError(400, "gzipBase64 is required");
  }
  return zlib.gunzipSync(Buffer.from(value, "base64"));
}

function minimalRbxlx() {
  return Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<roblox version="4">
  <External>null</External>
  <External>nil</External>
  <Item class="DataModel" referent="RBX0">
    <Properties>
      <Content name="MeshContentProvider">null</Content>
      <Content name="SkyboxContentProvider">null</Content>
      <Content name="SoundContentProvider">null</Content>
    </Properties>
    <Item class="Workspace" referent="RBX1">
      <Properties>
        <bool name="AllowThirdPartySales">false</bool>
        <CoordinateFrame name="CurrentCamera">
          <X>0</X><Y>0</Y><Z>0</Z>
          <R00>1</R00><R01>0</R01><R02>0</R02>
          <R10>0</R10><R11>1</R11><R12>0</R12>
          <R20>0</R20><R21>0</R21><R22>1</R22>
        </CoordinateFrame>
        <string name="Name">Workspace</string>
      </Properties>
    </Item>
  </Item>
</roblox>
`, "utf8");
}

function defaultTemplateBytes() {
  const envTemplate = process.env.DEFAULT_RBXL_TEMPLATE;
  const candidates = [
    envTemplate && path.resolve(envTemplate),
    path.join(DATA_DIR, "default.rbxl"),
    path.join(DATA_DIR, "default.rbxlx"),
    path.join(__dirname, "default.rbxl"),
    path.join(__dirname, "default.rbxlx"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate);
    }
  }
  return minimalRbxlx();
}

function refreshMetaFromDisk(channel, meta) {
  const paths = channelPaths(channel);
  if (!meta || !fs.existsSync(paths.file)) return meta;
  const bytes = fs.readFileSync(paths.file);
  const currentMd5 = md5(bytes);
  if (meta.md5 !== currentMd5 || meta.size !== bytes.length) {
    meta.md5 = currentMd5;
    meta.size = bytes.length;
    meta.updatedAt = new Date().toISOString();
    saveMeta(channel, meta);
  }
  return meta;
}

function filePayload(channel) {
  let meta = loadMeta(channel);
  if (!meta) throw httpError(404, "channel not found");
  const paths = channelPaths(channel);
  if (!fs.existsSync(paths.file)) throw httpError(404, "channel has no file yet");
  meta = refreshMetaFromDisk(channel, meta);
  const bytes = fs.readFileSync(paths.file);
  return {
    fileName: meta.fileName,
    md5: meta.md5,
    size: meta.size,
    updatedAt: meta.updatedAt,
    gzipBase64: gzipBase64(bytes),
  };
}

function statusPayload(channel) {
  const safe = safeChannelName(channel);
  let meta = loadMeta(safe);
  const paths = channelPaths(safe);
  const hasFile = fs.existsSync(paths.file);
  if (!meta) {
    return { ok: true, channel: safe, exists: false, hasFile: false, file: null };
  }
  meta = refreshMetaFromDisk(safe, meta);
  return {
    ok: true,
    channel: safe,
    exists: true,
    hasFile,
    file: hasFile
      ? {
          fileName: meta.fileName,
          md5: meta.md5,
          size: meta.size,
          updatedAt: meta.updatedAt,
        }
      : null,
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

function requireAuth(req) {
  if (!CENTRAL_TOKEN) return;
  const expected = `Bearer ${CENTRAL_TOKEN}`;
  if (req.headers.authorization !== expected) {
    throw httpError(401, "missing or invalid central token");
  }
}

function parseChannelPath(pathname, suffix) {
  const prefix = "/v1/channels/";
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  return decodeURIComponent(pathname.slice(prefix.length, pathname.length - suffix.length));
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "rbxl-channel-central", dataDir: DATA_DIR });
    return;
  }

  requireAuth(req);

  const statusChannel = parseChannelPath(url.pathname, "/status");
  if (req.method === "GET" && statusChannel) {
    sendJson(res, 200, statusPayload(statusChannel));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/handshake") {
    const body = await readJson(req);
    const channel = safeChannelName(body.channel);
    const paths = channelPaths(channel);
    const existed = fs.existsSync(paths.meta);
    if (!existed) {
      saveMeta(channel, {
        channel,
        fileName: null,
        md5: null,
        size: 0,
        updatedAt: new Date().toISOString(),
      });
    }
    sendJson(res, 200, {
      ok: true,
      channel,
      exists: existed,
      created: !existed,
      hasFile: fs.existsSync(paths.file),
      serverTime: new Date().toISOString(),
    });
    return;
  }

  const uploadChannel = parseChannelPath(url.pathname, "/file");
  if (req.method === "POST" && uploadChannel) {
    const body = await readJson(req);
    const bytes = gunzipBase64(body.gzipBase64);
    const meta = saveChannelFile(uploadChannel, body.fileName, bytes);
    sendJson(res, 200, { ok: true, action: "stored", channel: uploadChannel, meta });
    return;
  }

  const defaultChannel = parseChannelPath(url.pathname, "/default");
  if (req.method === "POST" && defaultChannel) {
    const body = await readJson(req);
    const meta = saveChannelFile(defaultChannel, body.fileName || "default.rbxlx", defaultTemplateBytes());
    sendJson(res, 200, {
      ok: true,
      action: "default-created",
      channel: defaultChannel,
      meta,
      file: filePayload(defaultChannel),
    });
    return;
  }

  const compareChannel = parseChannelPath(url.pathname, "/compare");
  if (req.method === "POST" && compareChannel) {
    const body = await readJson(req);
    const clientMd5 = String(body.md5 || "").toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(clientMd5)) throw httpError(400, "md5 must be 32 lowercase hex chars");
    const serverFile = filePayload(compareChannel);
    if (clientMd5 === serverFile.md5) {
      sendJson(res, 200, { ok: true, channel: compareChannel, same: true, md5: serverFile.md5 });
    } else {
      sendJson(res, 200, { ok: true, channel: compareChannel, same: false, file: serverFile });
    }
    return;
  }

  const getChannel = parseChannelPath(url.pathname, "/file");
  if (req.method === "GET" && getChannel) {
    sendJson(res, 200, { ok: true, channel: getChannel, file: filePayload(getChannel) });
    return;
  }

  throw httpError(404, "not found");
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    const status = err.status || 500;
    sendJson(res, status, { ok: false, error: err.message || "internal server error" });
  });
});

ensureDir(path.join(DATA_DIR, "channels"));
server.listen(PORT, HOST, () => {
  console.log(`RBXL central server listening on http://${HOST}:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  if (CENTRAL_TOKEN) console.log("Central token auth: enabled");
});
