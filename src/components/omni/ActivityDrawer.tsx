import { X, RotateCw, Trash2, CheckCircle2, XCircle, Loader2, Clock, Hand } from "lucide-react";
import { useMemo } from "react";
import {
  clearFinished,
  deleteCommand,
  updateCommand,
  type Command,
  type CommandStatus,
} from "@/lib/commands";
import type { Profile } from "@/lib/mock-profiles";

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  profilesById: Record<string, Profile>;
}

const STATUS_META: Record<
  CommandStatus,
  { label: string; color: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }
> = {
  queued: { label: "Queued", color: "var(--color-muted-foreground)", Icon: Clock },
  running: { label: "Running", color: "var(--color-primary)", Icon: Loader2 },
  awaiting: { label: "Awaiting", color: "oklch(0.78 0.16 80)", Icon: Hand },
  succeeded: { label: "Posted", color: "oklch(0.72 0.18 150)", Icon: CheckCircle2 },
  failed: { label: "Failed", color: "var(--color-destructive)", Icon: XCircle },
  cancelled: { label: "Cancelled", color: "var(--color-muted-foreground)", Icon: XCircle },
};

export function ActivityDrawer({ open, onClose, commands, profilesById }: Props) {
  const sorted = useMemo(
    () => [...commands].sort((a, b) => b.createdAt - a.createdAt),
    [commands],
  );
  const counts = useMemo(() => {
    const c: Record<CommandStatus, number> = {
      queued: 0, running: 0, awaiting: 0, succeeded: 0, failed: 0, cancelled: 0,
    };
    for (const cmd of commands) c[cmd.status]++;
    return c;
  }, [commands]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-background/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] h-full bg-card border-l border-border flex flex-col"
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div>
            <div className="text-sm font-semibold">Command Activity</div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {commands.length} total · {counts.queued} queued · {counts.running} running · {counts.failed} failed
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearFinished}
              className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-accent flex items-center gap-1"
              title="Remove succeeded/failed/cancelled"
            >
              <Trash2 className="h-3 w-3" /> Clear finished
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-border">
          {sorted.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No commands yet. Use the Bulk Command panel to distribute.
            </div>
          )}
          {sorted.map((c) => {
            const meta = STATUS_META[c.status];
            const profile = profilesById[c.profileId];
            return (
              <div key={c.id} className="p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <meta.Icon
                    className={`h-3.5 w-3.5 ${c.status === "running" ? "animate-spin" : ""}`}
                    style={{ color: meta.color }}
                  />
                  <span className="font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground font-mono">·</span>
                  <span className="font-mono truncate">{profile?.name ?? c.profileId}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {new Date(c.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {(c.payload.text || c.payload.hashtags) && (
                  <div className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">
                    {c.payload.text}
                    {c.payload.hashtags ? ` ${c.payload.hashtags}` : ""}
                  </div>
                )}
                {c.payload.targetUrl && (
                  <div className="text-[10px] text-primary font-mono truncate" title={c.payload.targetUrl}>
                    → {c.payload.targetUrl}
                  </div>
                )}
                {c.lastError && (
                  <div className="text-[10px] text-destructive font-mono">{c.lastError}</div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {c.platform} · {c.kind} · {c.adapter ?? "—"} · attempt {c.attempts}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {c.status === "awaiting" && (
                      <>
                        <button
                          onClick={() =>
                            updateCommand(c.id, { status: "succeeded", finishedAt: Date.now() })
                          }
                          className="text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                        >
                          Mark posted
                        </button>
                        <button
                          onClick={() =>
                            updateCommand(c.id, {
                              status: "cancelled",
                              finishedAt: Date.now(),
                            })
                          }
                          className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {(c.status === "failed" || c.status === "cancelled") && (
                      <button
                        onClick={() =>
                          updateCommand(c.id, {
                            status: "queued",
                            lastError: undefined,
                            startedAt: undefined,
                            finishedAt: undefined,
                          })
                        }
                        className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-accent flex items-center gap-1"
                      >
                        <RotateCw className="h-3 w-3" /> Retry
                      </button>
                    )}
                    {c.status !== "running" && (
                      <button
                        onClick={() => deleteCommand(c.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}