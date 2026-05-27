import type { Profile } from "./mock-profiles";
import type { AdapterId, Command, CommandKind } from "./commands";

export interface AdapterResult {
  ok: boolean;
  error?: string;
  /** When true, runner should mark command 'awaiting' and stop — user will resolve via UI. */
  awaiting?: boolean;
}

export interface CommandAdapter {
  id: AdapterId;
  label: string;
  description: string;
  run: (cmd: Command, profile: Profile) => Promise<AdapterResult>;
}

/** Pretends to post. Random 85% success after 600–1500ms. Ships now so the lifecycle is observable. */
const simulated: CommandAdapter = {
  id: "simulated",
  label: "Simulated",
  description: "Fake executor — randomly succeeds/fails after a short delay. Use for demos & UI testing.",
  run: async () => {
    const delay = 600 + Math.random() * 900;
    await new Promise((r) => setTimeout(r, delay));
    if (Math.random() < 0.85) return { ok: true };
    return { ok: false, error: "Simulated transient failure (rate-limited)" };
  },
};

/** Resolves the deep link for a command/profile, by kind. */
export function resolveCycleUrl(cmd: Command, profile: Profile): string {
  const target = cmd.payload.targetUrl?.trim();
  switch (cmd.kind) {
    case "post":
      return target || "https://www.tiktok.com/upload";
    case "comment":
    case "like":
      return target || profile.currentUrl || profile.loginUrl;
    case "dm": {
      if (target) return target;
      const u = profile.username?.replace(/^@/, "");
      return u ? `https://www.tiktok.com/messages?u=${encodeURIComponent(u)}` : "https://www.tiktok.com/messages";
    }
    default:
      return profile.currentUrl || profile.loginUrl;
  }
}

const CYCLE_WINDOW_NAME = "omni-cycle";

/** Builds the clipboard payload (caption + hashtags) for a command. */
export function clipboardPayload(cmd: Command): string {
  const parts: string[] = [];
  if (cmd.payload.text) parts.push(cmd.payload.text);
  if (cmd.payload.hashtags) parts.push(cmd.payload.hashtags);
  return parts.join(" ").trim();
}

const KIND_LABEL: Record<CommandKind, string> = {
  post: "Post",
  comment: "Comment",
  dm: "DM",
  like: "Like",
};

export { KIND_LABEL };

/** Guided cycle: reuses ONE pop-out tab across the queue, pre-copies payload, waits for user "Done". */
const guidedCycle: CommandAdapter = {
  id: "guided-cycle",
  label: "Guided cycle (manual)",
  description: "Opens ONE reusable pop-out, copies caption to clipboard, advances to the next account when you press Done.",
  run: async (cmd, profile) => {
    if (typeof window === "undefined") return { ok: false, error: "No window context" };
    const url = resolveCycleUrl(cmd, profile);
    // Pre-copy payload (best effort; clipboard may be blocked on first call)
    const text = clipboardPayload(cmd);
    if (text && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
    // Reuse the same named window across the cycle so subsequent commands replace the tab.
    try {
      window.open(url, CYCLE_WINDOW_NAME, "width=480,height=820");
    } catch {}
    return { ok: false, awaiting: true };
  },
};

/** Stub for a future browser extension. Posts a message and times out if no ack. */
const extensionBridge: CommandAdapter = {
  id: "extension-bridge",
  label: "Extension bridge",
  description: "Sends the command to a companion browser extension via postMessage. Fails fast if none is installed.",
  run: (cmd) =>
    new Promise<AdapterResult>((resolve) => {
      if (typeof window === "undefined") return resolve({ ok: false, error: "No window context" });
      const reqId = cmd.id;
      const handler = (ev: MessageEvent) => {
        if (ev.data?.source !== "omni-extension" || ev.data?.reqId !== reqId) return;
        window.removeEventListener("message", handler);
        clearTimeout(t);
        resolve(ev.data.ok ? { ok: true } : { ok: false, error: ev.data.error ?? "Extension reported failure" });
      };
      window.addEventListener("message", handler);
      window.postMessage({ source: "omni-app", type: "command", reqId, command: cmd }, "*");
      const t = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ ok: false, error: "No extension responded (install the OmniSocial extension to enable)" });
      }, 2500);
    }),
};

export const ADAPTERS: Record<AdapterId, CommandAdapter> = {
  simulated,
  "guided-cycle": guidedCycle,
  "extension-bridge": extensionBridge,
};

export const ADAPTER_LIST: CommandAdapter[] = [guidedCycle, simulated, extensionBridge];

const LS_KEY = "omni:adapter:v1";

export function loadAdapterId(): AdapterId {
  if (typeof window === "undefined") return "simulated";
  const v = window.localStorage.getItem(LS_KEY) as AdapterId | null;
  return v && v in ADAPTERS ? v : "simulated";
}
export function saveAdapterId(id: AdapterId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, id);
}