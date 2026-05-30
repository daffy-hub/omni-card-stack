/**
 * Renderer-side bridge to the Electron main process.
 *
 * When the app runs inside Electron, the preload script exposes
 * `window.omni` with these methods. In the web preview, `window.omni`
 * is `undefined` — guard every call with `isElectron()`.
 */
import type { Command } from "./commands";
import type { Profile } from "./mock-profiles";

export type ActionStatus =
  | "launching"
  | "logging-in"
  | "needs-login"
  | "needs-captcha"
  | "running"
  | "succeeded"
  | "failed";

export interface ActionResult {
  ok: boolean;
  awaiting?: boolean;
  status?: ActionStatus;
  error?: string;
}

export interface OmniBridge {
  isElectron: true;
  /** Launch (or reuse) a persistent Chromium context for this profile. */
  launchProfile: (profileId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Run one command against the profile's context. */
  runAction: (cmd: Command, profile: Profile) => Promise<ActionResult>;
  /** Close + dispose this profile's context. */
  closeProfile: (profileId: string) => Promise<void>;
  /** List sessions currently warm in memory. */
  listSessions: () => Promise<string[]>;
  /** Push the latest session blob to Lovable Cloud (encrypted). */
  syncProfile: (profileId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Pull session from cloud and hydrate the local userDataDir. */
  restoreProfile: (profileId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Subscribe to live status updates ("posting…", "captcha", etc.). */
  onStatus: (cb: (e: { profileId: string; status: ActionStatus; message?: string }) => void) => () => void;
}

declare global {
  interface Window {
    omni?: OmniBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.omni?.isElectron;
}

export function getBridge(): OmniBridge | null {
  if (typeof window === "undefined") return null;
  return window.omni ?? null;
}