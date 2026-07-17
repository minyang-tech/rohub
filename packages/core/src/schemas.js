const PROJECT_TYPES = Object.freeze({
  RBXL_FILE: "rbxl-file",
  RBXLX_FILE: "rbxlx-file",
  ROJO_FOLDER: "rojo-folder",
});

function isSupportedProjectType(value) {
  return Object.values(PROJECT_TYPES).includes(value);
}

function isSafeChannelName(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(value);
}

module.exports = { PROJECT_TYPES, isSupportedProjectType, isSafeChannelName };