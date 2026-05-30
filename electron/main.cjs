/* eslint-disable */
// Electron main process. Loads the built SPA and brokers Playwright + session-vault IPC.
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let manager = null;
let vault = null;
let cloud = null;

function loadManagers() {
  // Lazy-require so the bundle still starts even if Playwright isn't installed yet.
  try {
    manager = require("./playwright-manager.cjs");
    vault = require("./session-vault.cjs");
    cloud = require("./cloud-sync.cjs");
  } catch (e) {
    console.error("[omni] Failed to load runtime modules:", e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#0a0a0a",
  });

  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexHtml)) {
    win.loadFile(indexHtml);
  } else {
    // Dev fallback — point at the Vite dev server.
    win.loadURL(process.env.OMNI_DEV_URL || "http://localhost:8080");
  }
}

app.whenReady().then(() => {
  loadManagers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  try { await manager?.disposeAll(); } catch {}
  if (process.platform !== "darwin") app.quit();
});

// -- IPC routing ----------------------------------------------------------
ipcMain.handle("omni:launchProfile", async (_e, profileId) => {
  if (!manager) return { ok: false, error: "playwright-manager not loaded" };
  return manager.launchProfile(profileId);
});

ipcMain.handle("omni:runAction", async (_e, { cmd, profile }) => {
  if (!manager) return { ok: false, error: "playwright-manager not loaded" };
  return manager.runAction(cmd, profile);
});

ipcMain.handle("omni:closeProfile", async (_e, profileId) => {
  if (!manager) return;
  return manager.closeProfile(profileId);
});

ipcMain.handle("omni:listSessions", async () => {
  if (!manager) return [];
  return manager.listSessions();
});

ipcMain.handle("omni:syncProfile", async (_e, profileId) => {
  if (!vault || !cloud) return { ok: false, error: "vault/cloud not loaded" };
  try {
    const snapshot = await vault.snapshot(profileId);
    await cloud.push(profileId, snapshot);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle("omni:restoreProfile", async (_e, profileId) => {
  if (!vault || !cloud) return { ok: false, error: "vault/cloud not loaded" };
  try {
    const snapshot = await cloud.pull(profileId);
    if (!snapshot) return { ok: false, error: "no cloud session" };
    await vault.hydrate(profileId, snapshot);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
});