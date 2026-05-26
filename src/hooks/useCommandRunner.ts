import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/mock-profiles";
import {
  subscribeCommands,
  updateCommand,
  type Command,
} from "@/lib/commands";
import { ADAPTERS, type CommandAdapter } from "@/lib/command-adapters";

/**
 * Drains the `queued` commands one-at-a-time through the active adapter.
 * Re-runs whenever the queue changes or the adapter changes.
 */
export function useCommandRunner(
  adapter: CommandAdapter,
  getProfile: (id: string) => Profile | undefined,
  onStatus?: (cmd: Command, result: "succeeded" | "failed" | "awaiting") => void,
) {
  const busyRef = useRef(false);
  const adapterRef = useRef(adapter);
  const getProfileRef = useRef(getProfile);
  const onStatusRef = useRef(onStatus);
  adapterRef.current = adapter;
  getProfileRef.current = getProfile;
  onStatusRef.current = onStatus;

  useEffect(() => {
    let cancelled = false;

    const tick = async (commands: Command[]) => {
      if (busyRef.current || cancelled) return;
      const next = commands.find((c) => c.status === "queued");
      if (!next) return;
      const profile = getProfileRef.current(next.profileId);
      if (!profile) {
        updateCommand(next.id, {
          status: "failed",
          lastError: "Profile no longer exists",
          finishedAt: Date.now(),
        });
        return;
      }

      busyRef.current = true;
      updateCommand(next.id, {
        status: "running",
        startedAt: Date.now(),
        attempts: next.attempts + 1,
        adapter: adapterRef.current.id,
      });

      try {
        const result = await adapterRef.current.run(next, profile);
        if (cancelled) return;
        if (result.awaiting) {
          updateCommand(next.id, { status: "awaiting" });
          onStatusRef.current?.(next, "awaiting");
        } else if (result.ok) {
          updateCommand(next.id, { status: "succeeded", finishedAt: Date.now() });
          onStatusRef.current?.(next, "succeeded");
        } else {
          updateCommand(next.id, {
            status: "failed",
            lastError: result.error ?? "Unknown error",
            finishedAt: Date.now(),
          });
          onStatusRef.current?.(next, "failed");
        }
      } catch (e) {
        updateCommand(next.id, {
          status: "failed",
          lastError: e instanceof Error ? e.message : String(e),
          finishedAt: Date.now(),
        });
        onStatusRef.current?.(next, "failed");
      } finally {
        busyRef.current = false;
      }
    };

    const unsub = subscribeCommands(tick);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
}

export function useCommands(): Command[] {
  const [commands, setCommands] = useState<Command[]>([]);
  useEffect(() => subscribeCommands(setCommands), []);
  return commands;
}

export { ADAPTERS };