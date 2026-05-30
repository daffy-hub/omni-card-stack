/* eslint-disable */
// Push/pull encrypted session blobs to Lovable Cloud via the TanStack server fns.
// The Electron main process talks to the same backend the web UI does — it
// just needs a base URL + the user's bearer token (stored after first login
// in the renderer; the renderer forwards it via IPC the first time).
const { app } = require("electron");
const path = require("path");
const fs = require("fs/promises");

const BASE_URL = process.env.OMNI_API_BASE || "https://id-preview--c0f2a4c9-2cf3-4546-9582-faa2fd8628da.lovable.app";

async function deviceId() {
  const p = path.join(app.getPath("userData"), "device.id");
  try { return (await fs.readFile(p, "utf8")).trim(); }
  catch {
    const id = `dev_${Math.random().toString(36).slice(2, 12)}`;
    await fs.writeFile(p, id);
    return id;
  }
}

async function token() {
  const p = path.join(app.getPath("userData"), "auth.token");
  try { return (await fs.readFile(p, "utf8")).trim(); } catch { return ""; }
}

/** Set the bearer token (called from renderer once after sign-in). */
async function setToken(t) {
  const p = path.join(app.getPath("userData"), "auth.token");
  await fs.writeFile(p, t || "", { mode: 0o600 });
}

async function call(fnPath, body) {
  const t = await token();
  if (!t) throw new Error("Not signed in (no bearer token saved)");
  const res = await fetch(`${BASE_URL}/_serverFn/${fnPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) throw new Error(`${fnPath} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function push(profileId, snapshot) {
  return call("putProfileSession", {
    profileId,
    encryptedBlob: snapshot.ciphertext,
    blobIv: snapshot.iv || "AA==",
    deviceId: await deviceId(),
  });
}

async function pull(profileId) {
  const row = await call("getProfileSession", { profileId });
  if (!row) return null;
  return { kind: "aes-gcm", ciphertext: row.encrypted_blob, iv: row.blob_iv };
}

module.exports = { push, pull, setToken };