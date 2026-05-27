import { useEffect, useState } from "react";
import { ExternalLink, Check, SkipForward, X, Pause, Play, Clipboard } from "lucide-react";
import type { Command } from "@/lib/commands";
import type { Profile } from "@/lib/mock-profiles";
import {
  resolveCommand,
  setRunnerPaused,
  subscribePaused,
} from "@/hooks/useCommandRunner";
import { resolveCycleUrl, clipboardPayload, KIND_LABEL } from "@/lib/command-adapters";

interface Props {
  command: Command | null;
  profile: Profile | null;
  queuedAhead: number;
  totalRemaining: number;
  onNotify?: (msg: string) => void;
}

const CYCLE_WINDOW_NAME = "omni-cycle";

export function CycleHud({ command, profile, queuedAhead, totalRemaining, onNotify }: Props) {
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribePaused(setPaused), []);
  useEffect(() => {
    setCopied(false);
    if (!command) return;
    const text = clipboardPayload(command);
    if (text && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    } else {
      setCopied(!text); // nothing to copy = trivially ready
    }
  }, [command?.id]);

  useEffect(() => {
    if (!command) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === "Enter") { e.preventDefault(); done(); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); skip(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); fail(); }
      else if (e.key === "Escape") { e.preventDefault(); togglePause(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.id, paused]);

  if (!command || !profile) return null;

  const url = resolveCycleUrl(command, profile);
  const payloadText = clipboardPayload(command);

  const reopen = () => {
    try { window.open(url, CYCLE_WINDOW_NAME, "width=480,height=820"); } catch {}
  };
  const copyAgain = async () => {
    if (!payloadText) return;
    try { await navigator.clipboard.writeText(payloadText); setCopied(true); onNotify?.("Copied to clipboard"); } catch {}
  };
  const done = () => { resolveCommand(command.id, "succeeded"); onNotify?.(`✓ ${profile.name}`); };
  const skip = () => { resolveCommand(command.id, "cancelled"); onNotify?.(`↷ Skipped ${profile.name}`); };
  const fail = () => {
    const reason = window.prompt("Failure reason?", "") || "Marked failed by user";
    resolveCommand(command.id, "failed", reason);
    onNotify?.(`✕ Failed ${profile.name}`);
  };
  const togglePause = () => setRunnerPaused(!paused);

  return (
    <div className="fixed bottom-4 right-4 z-[55] w-[360px] rounded-lg border border-primary/40 bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/30">
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground uppercase tracking-wider text-[10px]">
            {KIND_LABEL[command.kind]}
          </span>
          <span className="font-semibold truncate max-w-[160px]">{profile.name}</span>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {totalRemaining - queuedAhead} / {totalRemaining}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span>Payload</span>
          <span className={`flex items-center gap-1 ${copied ? "text-[oklch(0.72_0.18_150)]" : "text-muted-foreground"}`}>
            <Clipboard className="h-3 w-3" />
            {payloadText ? (copied ? "Clipboard ready" : "Copy blocked") : "no text"}
          </span>
        </div>
        {payloadText ? (
          <div className="text-[11px] font-mono bg-input rounded p-2 max-h-20 overflow-auto whitespace-pre-wrap">
            {payloadText}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-muted-foreground italic">
            (no caption — {command.kind} action only)
          </div>
        )}
        <div className="text-[10px] text-muted-foreground font-mono truncate" title={url}>
          → {url}
        </div>

        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            onClick={reopen}
            className="col-span-2 flex items-center justify-center gap-1 px-2 py-2 rounded bg-secondary hover:bg-accent text-[11px] font-semibold"
            title="Open / re-open the cycle tab"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open tab
          </button>
          <button
            onClick={copyAgain}
            disabled={!payloadText}
            className="col-span-2 flex items-center justify-center gap-1 px-2 py-2 rounded bg-secondary hover:bg-accent text-[11px] font-semibold disabled:opacity-40"
          >
            <Clipboard className="h-3.5 w-3.5" /> Copy
          </button>

          <button
            onClick={done}
            className="col-span-2 flex items-center justify-center gap-1 px-2 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 text-[11px] font-semibold"
            title="Done (⏎)"
          >
            <Check className="h-3.5 w-3.5" /> Done ⏎
          </button>
          <button
            onClick={skip}
            className="flex items-center justify-center gap-1 px-2 py-2 rounded bg-secondary hover:bg-accent text-[11px]"
            title="Skip (S)"
          >
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </button>
          <button
            onClick={fail}
            className="flex items-center justify-center gap-1 px-2 py-2 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 text-[11px]"
            title="Fail (F)"
          >
            <X className="h-3.5 w-3.5" /> Fail
          </button>

          <button
            onClick={togglePause}
            className="col-span-4 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-secondary/60 hover:bg-accent text-[10px] uppercase tracking-wider"
            title="Pause (Esc)"
          >
            {paused ? <><Play className="h-3 w-3" /> Resume cycle</> : <><Pause className="h-3 w-3" /> Pause cycle</>}
          </button>
        </div>
      </div>
    </div>
  );
}