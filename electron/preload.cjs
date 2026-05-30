/* eslint-disable */
const { contextBridge, ipcRenderer } = require("electron");

const statusListeners = new Set();
ipcRenderer.on("omni:status", (_e, payload) => {
  for (const cb of statusListeners) {
    try { cb(payload); } catch {}
  }
});

contextBridge.exposeInMainWorld("omni", {
  isElectron: true,
  launchProfile: (profileId) => ipcRenderer.invoke("omni:launchProfile", profileId),
  runAction: (cmd, profile) => ipcRenderer.invoke("omni:runAction", { cmd, profile }),
  closeProfile: (profileId) => ipcRenderer.invoke("omni:closeProfile", profileId),
  listSessions: () => ipcRenderer.invoke("omni:listSessions"),
  syncProfile: (profileId) => ipcRenderer.invoke("omni:syncProfile", profileId),
  restoreProfile: (profileId) => ipcRenderer.invoke("omni:restoreProfile", profileId),
  onStatus: (cb) => {
    statusListeners.add(cb);
    return () => statusListeners.delete(cb);
  },
});