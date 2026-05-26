import { Layers, Hash, Filter, Folder } from "lucide-react";
import type { Profile } from "@/lib/mock-profiles";

interface Group {
  key: string;
  label: string;
  count: number;
}

interface Props {
  profiles: Profile[];
  activeGroup: string;
  onGroupChange: (key: string) => void;
  onSelectGroup: (key: string) => void;
  keywords: string;
  onKeywordsChange: (v: string) => void;
}

export function Sidebar({ profiles, activeGroup, onGroupChange, onSelectGroup, keywords, onKeywordsChange }: Props) {
  const platforms = ["tiktok"] as const;
  const niches = Array.from(new Set(profiles.map((p) => p.niche)));

  const platformGroups: Group[] = platforms.map((p) => ({
    key: `platform:${p}`,
    label: "All TikTok",
    count: profiles.filter((x) => x.platform === p).length,
  }));

  const nicheGroups: Group[] = niches.map((n) => ({
    key: `niche:${n}`,
    label: n,
    count: profiles.filter((x) => x.niche === n).length,
  }));

  const renderGroup = (g: Group) => {
    const isActive = activeGroup === g.key;
    return (
      <div
        key={g.key}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer ${
          isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary"
        }`}
        onClick={() => onGroupChange(g.key)}
      >
        <Folder className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">{g.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{g.count}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectGroup(g.key);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30"
          title="Bulk-select this group"
        >
          +sel
        </button>
      </div>
    );
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4 text-primary" />
          OmniSocial Studio
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          mass profile workspace
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-4">
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" /> Target keywords
          </div>
          <input
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder="marketing, tech, business"
            className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <div className="text-[9px] text-muted-foreground mt-1 font-mono px-1">
            comma-separated · boosts SEO score
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3 w-3" /> All
          </div>
          {renderGroup({ key: "all", label: "All Profiles", count: profiles.length })}
        </div>

        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" /> Platforms
          </div>
          {platformGroups.map(renderGroup)}
        </div>

        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3 w-3" /> Niches
          </div>
          {nicheGroups.map(renderGroup)}
        </div>
      </div>
    </aside>
  );
}
