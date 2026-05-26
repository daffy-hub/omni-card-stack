import type { Platform } from "./mock-profiles";

export type CommandStatus =
  | "queued"
  | "running"
  | "awaiting" // waiting on a manual user action (e.g. pop-out paste & post)
  | "succeeded"
  | "failed"
  | "cancelled";

export type CommandKind = "post" | "comment" | "dm";

export interface CommandPayload {
  text: string;
  hashtags?: string;
}

export interface Command {
  id: string;
  profileId: string;
  platform: Platform;
  kind: CommandKind;
  payload: CommandPayload;
  status: CommandStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  adapter?: AdapterId;
}

export type AdapterId = "simulated" | "manual-popout" | "extension-bridge";

const LS_KEY = "omni:commands:v1";
const MAX_HISTORY = 500;

type Listener = (commands: Command[]) => void;
const listeners = new Set<Listener>();
let cache: Command[] | null = null;

function readStore(): Command[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    cache = raw ? (JSON.parse(raw) as Command[]) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function writeStore(next: Command[]) {
  cache = next.slice(-MAX_HISTORY);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
    } catch {}
  }
  for (const l of listeners) l(cache);
}

export function subscribeCommands(fn: Listener): () => void {
  listeners.add(fn);
  // Fire once with current state
  fn(readStore());
  return () => listeners.delete(fn);
}

export function getCommands(): Command[] {
  return readStore();
}

export function enqueueCommand(input: Omit<Command, "id" | "status" | "attempts" | "createdAt">): Command {
  const cmd: Command = {
    ...input,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "queued",
    attempts: 0,
    createdAt: Date.now(),
  };
  writeStore([...readStore(), cmd]);
  return cmd;
}

export function updateCommand(id: string, patch: Partial<Command>) {
  writeStore(readStore().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function deleteCommand(id: string) {
  writeStore(readStore().filter((c) => c.id !== id));
}

export function clearFinished() {
  writeStore(
    readStore().filter(
      (c) => c.status === "queued" || c.status === "running" || c.status === "awaiting",
    ),
  );
}

/** Latest command per profile (by createdAt). */
export function latestByProfile(commands: Command[]): Record<string, Command> {
  const out: Record<string, Command> = {};
  for (const c of commands) {
    const prev = out[c.profileId];
    if (!prev || c.createdAt > prev.createdAt) out[c.profileId] = c;
  }
  return out;
}