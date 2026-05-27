import { Send, Eraser, CheckSquare, Square, Trash2, Hash, Activity, Cpu, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import type { Profile } from "@/lib/mock-profiles";
import { ADAPTER_LIST, KIND_LABEL } from "@/lib/command-adapters";
import type { AdapterId, CommandKind } from "@/lib/commands";

interface Props {
  profiles: Profile[];
  selectedIds: Set<string>;
  bulkText: string;
  setBulkText: (s: string) => void;
  onDistribute: (kind: CommandKind, targetUrl: string) => void;
  onClearDrafts: () => void;
  onClearAllDrafts: () => void;
  onAppendHashtags: (tags: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  adapterId: AdapterId;
  onAdapterChange: (id: AdapterId) => void;
  onOpenActivity: () => void;
  queueStats: { queued: number; running: number; awaiting: number; failed: number };
}

export function CommandPanel({
  profiles,
  selectedIds,
  bulkText,
  setBulkText,
  onDistribute,
  onClearDrafts,
  onClearAllDrafts,
  onAppendHashtags,
  onSelectAllVisible,
  onClearSelection,
  adapterId,
  onAdapterChange,
  onOpenActivity,
  queueStats,
}: Props) {
  const [hashtags, setHashtags] = useState("");
  const [kind, setKind] = useState<CommandKind>("post");
  const [targetUrl, setTargetUrl] = useState("");
  const flagged = profiles.filter((p) => p.status === "flagged").length;
  const filled = profiles.filter((p) => p.draft.length > 0).length;
  const hasSpintax = /\{[^{}]+\|[^{}]+\}/.test(bulkText);
  const activeAdapter = ADAPTER_LIST.find((a) => a.id === adapterId)!;
  const KINDS: CommandKind[] = ["post", "comment", "like", "dm"];
  const needsTarget = kind !== "post";
  const needsText = kind !== "like";
  const canDistribute =
    selectedIds.size > 0 &&
    (!needsText || bulkText.length > 0) &&
    (!needsTarget || targetUrl.trim().length > 0);

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
      <div className="px-3 py-3 border-b border-border">
        <div className="text-sm font-semibold">Bulk Command</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {selectedIds.size} selected · {profiles.length} visible
        </div>
      </div>

      {/* Execution adapter + activity */}
      <div className="px-3 py-2 border-b border-border space-y-1.5">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Cpu className="h-3 w-3" /> Executor
        </label>
        <select
          value={adapterId}
          onChange={(e) => onAdapterChange(e.target.value as AdapterId)}
          className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
        >
          {ADAPTER_LIST.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <div className="text-[10px] text-muted-foreground leading-snug">
          {activeAdapter.description}
        </div>
        <button
          onClick={onOpenActivity}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-secondary hover:bg-accent text-[11px] font-mono"
        >
          <span className="flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Activity
          </span>
          <span className="flex items-center gap-2 text-[10px]">
            <span title="Queued">⏱ {queueStats.queued}</span>
            <span title="Running" className="text-primary">▶ {queueStats.running}</span>
            <span title="Awaiting" style={{ color: "oklch(0.78 0.16 80)" }}>✋ {queueStats.awaiting}</span>
            <span title="Failed" className="text-destructive">✕ {queueStats.failed}</span>
          </span>
        </button>
      </div>

      {/* Command kind */}
      <div className="px-3 py-2 border-b border-border space-y-1.5">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</label>
        <div className="grid grid-cols-4 gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-[10px] uppercase tracking-wider py-1 rounded font-mono ${
                kind === k ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent text-muted-foreground"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {needsTarget && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" /> Target URL
            </label>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={
                kind === "dm"
                  ? "https://www.tiktok.com/messages?u=username"
                  : "https://www.tiktok.com/@user/video/123…"
              }
              className="mt-1 w-full bg-input rounded px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>
        )}
      </div>

      {/* Mass-account quick actions */}
      <div className="px-3 py-2 border-b border-border grid grid-cols-2 gap-1.5">
        <button
          onClick={onSelectAllVisible}
          className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded bg-secondary hover:bg-accent"
        >
          <CheckSquare className="h-3 w-3" /> All visible
        </button>
        <button
          onClick={onClearSelection}
          className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded bg-secondary hover:bg-accent"
        >
          <Square className="h-3 w-3" /> Clear sel
        </button>
        <button
          onClick={onClearDrafts}
          className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded bg-secondary hover:bg-accent"
        >
          <Eraser className="h-3 w-3" /> Clear in view
        </button>
        <button
          onClick={onClearAllDrafts}
          className="flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
        >
          <Trash2 className="h-3 w-3" /> Clear ALL
        </button>
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-auto">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {needsText ? "Composer" : "Composer (not used for Like)"} · Spintax {hasSpintax && <span className="text-primary">active</span>}
          </label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            disabled={!needsText}
            placeholder={`Hello {team|friends|folks}, check our new {product|app}!`}
            className="mt-1 w-full h-40 resize-none bg-input rounded p-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono disabled:opacity-40"
          />
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            {bulkText.length} ch · {`{a|b}`} = random per account
          </div>
        </div>

        <button
          onClick={() => onDistribute(kind, targetUrl.trim())}
          disabled={!canDistribute}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          Queue {KIND_LABEL[kind]} × {selectedIds.size}
        </button>

        <div className="pt-2 border-t border-border">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Hash className="h-3 w-3" /> Append global hashtags
          </label>
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#SEO #Growth"
            className="mt-1 w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <button
            onClick={() => {
              if (hashtags.trim()) onAppendHashtags(hashtags.trim());
            }}
            disabled={selectedIds.size === 0 || !hashtags.trim()}
            className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-secondary text-xs hover:bg-accent disabled:opacity-40"
          >
            Append to {selectedIds.size} selected
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <Stat label="Drafts ready" value={filled} accent="filled" />
          <Stat label="Flagged" value={flagged} accent="flagged" />
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: "filled" | "flagged" }) {
  return (
    <div className="rounded-md bg-secondary p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className="text-xl font-bold font-mono"
        style={{ color: accent === "filled" ? "var(--color-status-filled)" : "var(--color-status-flagged)" }}
      >
        {value}
      </div>
    </div>
  );
}
