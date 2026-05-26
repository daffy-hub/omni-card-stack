import { Send, Eraser, CheckSquare, Square, Trash2, Hash } from "lucide-react";
import { useState } from "react";
import type { Profile } from "@/lib/mock-profiles";

interface Props {
  profiles: Profile[];
  selectedIds: Set<string>;
  bulkText: string;
  setBulkText: (s: string) => void;
  onDistribute: () => void;
  onClearDrafts: () => void;
  onClearAllDrafts: () => void;
  onAppendHashtags: (tags: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
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
}: Props) {
  const [hashtags, setHashtags] = useState("");
  const flagged = profiles.filter((p) => p.status === "flagged").length;
  const filled = profiles.filter((p) => p.draft.length > 0).length;
  const hasSpintax = /\{[^{}]+\|[^{}]+\}/.test(bulkText);

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card flex flex-col">
      <div className="px-3 py-3 border-b border-border">
        <div className="text-sm font-semibold">Bulk Command</div>
        <div className="text-[10px] text-muted-foreground font-mono">
          {selectedIds.size} selected · {profiles.length} visible
        </div>
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
            Global composer · Spintax {hasSpintax && <span className="text-primary">active</span>}
          </label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Hello {team|friends|folks}, check our new {product|app}!`}
            className="mt-1 w-full h-40 resize-none bg-input rounded p-2 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            {bulkText.length} ch · {`{a|b}`} = random per account
          </div>
        </div>

        <button
          onClick={onDistribute}
          disabled={selectedIds.size === 0 || bulkText.length === 0}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          Distribute to {selectedIds.size} profile{selectedIds.size === 1 ? "" : "s"}
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
