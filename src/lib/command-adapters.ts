import type { Profile } from "./mock-profiles";
import type { AdapterId, Command } from "./commands";

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

/** Opens credential pop-out + platform compose URL; waits for user to confirm via the card. */
const manualPopout: CommandAdapter = {
  id: "manual-popout",
  label: "Manual pop-out",
  description: "Opens the platform in a pop-out window with credentials visible. You paste & post, then confirm on the card.",
  run: async (_cmd, profile) => {
    if (typeof window === "undefined") return { ok: false, error: "No window context" };
    window.open(profile.currentUrl || profile.loginUrl, "_blank", "width=450,height=700");
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
  "manual-popout": manualPopout,
  "extension-bridge": extensionBridge,
};

export const ADAPTER_LIST: CommandAdapter[] = [simulated, manualPopout, extensionBridge];

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