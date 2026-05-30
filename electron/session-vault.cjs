/* eslint-disable */
// Snapshot / hydrate the auth-bearing pieces of a profile's userDataDir.
// We sync only cookies + localStorage + IndexedDB — NOT the full Chromium
// profile (too big, full of caches and binaries).
const { app, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");

function dirFor(profileId) {
  return path.join(app.getPath("userData"), "sessions", profileId);
}

const FILES = [
  "Default/Cookies",
  "Default/Cookies-journal",
  "Default/Local Storage",
  "Default/IndexedDB",
];

async function readMaybe(p) {
  try { return await fs.readFile(p); } catch { return null; }
}

/** Pack the session into one encrypted blob. */
async function snapshot(profileId) {
  const root = dirFor(profileId);
  const parts = {};
  for (const rel of FILES) {
    const buf = await readMaybe(path.join(root, rel));
    if (buf) parts[rel] = buf.toString("base64");
  }
  const json = Buffer.from(JSON.stringify(parts), "utf8");

  // Prefer OS keychain via safeStorage; fall back to AES-GCM with a
  // device-local key if encryption isn't available.
  if (safeStorage?.isEncryptionAvailable?.()) {
    const ct = safeStorage.encryptString(json.toString("base64"));
    return { kind: "safeStorage", ciphertext: ct.toString("base64"), iv: "" };
  }
  const key = await deviceKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(json), cipher.final(), cipher.getAuthTag()]);
  return { kind: "aes-gcm", ciphertext: enc.toString("base64"), iv: iv.toString("base64") };
}

/** Unpack an encrypted snapshot into the userDataDir. */
async function hydrate(profileId, snap) {
  const root = dirFor(profileId);
  let json;
  if (snap.kind === "safeStorage" && safeStorage?.isEncryptionAvailable?.()) {
    const ct = Buffer.from(snap.ciphertext, "base64");
    json = Buffer.from(safeStorage.decryptString(ct), "base64");
  } else {
    const key = await deviceKey();
    const iv = Buffer.from(snap.iv, "base64");
    const data = Buffer.from(snap.ciphertext, "base64");
    const tag = data.subarray(data.length - 16);
    const body = data.subarray(0, data.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    json = Buffer.concat([decipher.update(body), decipher.final()]);
  }
  const parts = JSON.parse(json.toString("utf8"));
  for (const [rel, b64] of Object.entries(parts)) {
    const dest = path.join(root, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(b64, "base64"));
  }
}

async function deviceKey() {
  const keyPath = path.join(app.getPath("userData"), "device.key");
  try {
    return await fs.readFile(keyPath);
  } catch {
    const k = crypto.randomBytes(32);
    await fs.writeFile(keyPath, k, { mode: 0o600 });
    return k;
  }
}

module.exports = { snapshot, hydrate };