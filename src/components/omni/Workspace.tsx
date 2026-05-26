import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { generateProfiles, spintax, PLATFORM_LOGIN_URL, type Profile, type Platform } from "@/lib/mock-profiles";
import { Sidebar } from "./Sidebar";
import { CommandPanel } from "./CommandPanel";
import { ProfileCard } from "./ProfileCard";
import { VaultManager } from "./VaultManager";
import { PopoutCredentialWidget } from "./PopoutCredentialWidget";
import { ActivityDrawer } from "./ActivityDrawer";
import {
  loadVault, saveVault, credentialToProfile, type Credential,
} from "@/lib/vault";
import { Search, ZoomIn, ShieldAlert, X, KeyRound, Globe } from "lucide-react";
import { TikTokIcon } from "./TikTokIcon";
import { enqueueCommand, latestByProfile } from "@/lib/commands";
import { ADAPTERS, loadAdapterId, saveAdapterId } from "@/lib/command-adapters";
import type { AdapterId } from "@/lib/commands";
import { useCommandRunner, useCommands } from "@/hooks/useCommandRunner";

const LS_KEY = "omni:auth-state:v1";

type AuthState = Record<string, { loggedIn?: boolean; currentUrl?: string }>;

function loadAuthState(): AuthState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : {};
  } catch {
    return {};
  }
}

function saveAuthState(state: AuthState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {}
}

const PLATFORM_FILTERS: { key: "all" | Platform; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All", Icon: Globe },
  { key: "tiktok", label: "TikTok", Icon: TikTokIcon },
];

export function Workspace() {
  const [profiles, setProfiles] = useState<Profile[]>(() => generateProfiles());
  const [vault, setVault] = useState<Credential[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState("all");
  const [scale, setScale] = useState(0.85);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");
  const [keywordsRaw, setKeywordsRaw] = useState("marketing, tech, business");
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const [bannerOpen, setBannerOpen] = useState(true);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [popoutCredId, setPopoutCredId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [adapterId, setAdapterId] = useState<AdapterId>(() => loadAdapterId());
  const hydratedRef = useRef(false);

  // Hydrate auth + vault on mount
  useEffect(() => {
    const saved = loadAuthState();
    const v = loadVault();
    const tiktokUrl = PLATFORM_LOGIN_URL.tiktok;
    setVault(v);
    setProfiles((prev) => {
      const merged = prev.map((p) => {
        const s = saved[p.id];
        // Force every profile's URL to TikTok, ignoring stale saved currentUrls
        // from previous platforms.
        return {
          ...p,
          loginUrl: tiktokUrl,
          currentUrl: tiktokUrl,
          loggedIn: s?.loggedIn ?? p.loggedIn,
        };
      });
      const have = new Set(merged.map((p) => p.credentialId).filter(Boolean));
      const additions = v.filter((c) => !have.has(c.id)).map((c) => {
        const profile = credentialToProfile(c);
        profile.loginUrl = tiktokUrl;
        profile.currentUrl = tiktokUrl;
        const s = saved[profile.id];
        if (s) profile.loggedIn = s.loggedIn ?? profile.loggedIn;
        return profile;
      });
      return [...merged, ...additions];
    });
    hydratedRef.current = true;
  }, []);

  // Persist auth state
  useEffect(() => {
    if (!hydratedRef.current) return;
    const state: AuthState = {};
    for (const p of profiles) state[p.id] = { loggedIn: p.loggedIn, currentUrl: p.currentUrl };
    saveAuthState(state);
  }, [profiles]);

  // Persist vault when it changes
  useEffect(() => {
    if (!hydratedRef.current) return;
    saveVault(vault);
  }, [vault]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((notify as any)._t);
    (notify as any)._t = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const keywords = useMemo(
    () => keywordsRaw.split(",").map((s) => s.trim()).filter(Boolean),
    [keywordsRaw],
  );

  const visibleProfiles = useMemo(() => {
    let out = profiles;
    if (activeGroup !== "all") {
      const [type, value] = activeGroup.split(":");
      out = out.filter((p) => (type === "platform" ? p.platform === value : p.niche === value));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((p) => p.name.toLowerCase().includes(q) || (p.username || "").toLowerCase().includes(q));
    }
    return out;
  }, [profiles, activeGroup, search]);

  const matchesGroup = useCallback((p: Profile, group: string) => {
    if (group === "all") return true;
    const [type, value] = group.split(":");
    return type === "platform" ? p.platform === value : p.niche === value;
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const onDraftChange = useCallback((id: string, value: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, draft: value } : p)));
  }, []);
  const onToggleView = useCallback((id: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, viewMode: p.viewMode === "form" ? "embed" : "form" } : p)));
  }, []);
  const onFlag = useCallback((id: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, status: p.status === "flagged" ? "idle" : "flagged" } : p)));
  }, []);
  const onUrlChange = useCallback((id: string, url: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, currentUrl: url } : p)));
  }, []);
  const onToggleLogin = useCallback((id: string) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, loggedIn: !p.loggedIn } : p)));
  }, []);

  const onPopout = useCallback((id: string) => {
    setProfiles((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p && typeof window !== "undefined") {
        window.open(p.currentUrl || p.loginUrl, "_blank", "width=450,height=600");
        if (p.credentialId) setPopoutCredId(p.credentialId);
      }
      return prev;
    });
  }, []);

  const triggerPulse = (ids: Set<string>) => {
    setPulsingIds(ids);
    setTimeout(() => setPulsingIds(new Set()), 750);
  };

  const distribute = () => {
    if (selectedIds.size === 0 || !bulkText) return;
    const ids = Array.from(selectedIds);
    setProfiles((prev) =>
      prev.map((p) => {
        if (!selectedIds.has(p.id)) return p;
        const text = spintax(bulkText);
        enqueueCommand({
          profileId: p.id,
          platform: p.platform,
          kind: "post",
          payload: { text },
        });
        return { ...p, draft: text };
      }),
    );
    triggerPulse(new Set(selectedIds));
    notify(`Queued ${ids.length} command${ids.length === 1 ? "" : "s"} via ${ADAPTERS[adapterId].label}`);
  };
  const clearDrafts = () => {
    const ids = new Set(visibleProfiles.map((p) => p.id));
    setProfiles((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, draft: "" } : p)));
    triggerPulse(ids);
  };
  const clearAllDrafts = () => {
    setProfiles((prev) => prev.map((p) => ({ ...p, draft: "" })));
    triggerPulse(new Set(profiles.map((p) => p.id)));
  };
  const appendHashtags = (tags: string) => {
    if (selectedIds.size === 0) return;
    setProfiles((prev) =>
      prev.map((p) =>
        selectedIds.has(p.id)
          ? { ...p, draft: (p.draft ? p.draft.trimEnd() + " " : "") + tags }
          : p,
      ),
    );
    triggerPulse(new Set(selectedIds));
  };

  const selectAllVisible = () => setSelectedIds(new Set(visibleProfiles.map((p) => p.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectGroup = (key: string) => {
    const ids = profiles.filter((p) => matchesGroup(p, key)).map((p) => p.id);
    setSelectedIds(new Set(ids));
  };

  // Vault mutations — keep vault state and profile cards in sync
  const addCredential = (c: Credential) => {
    setVault((v) => [...v, c]);
    setProfiles((prev) => [...prev, credentialToProfile(c)]);
  };
  const addCredentials = (creds: Credential[]) => {
    setVault((v) => [...v, ...creds]);
    setProfiles((prev) => [...prev, ...creds.map(credentialToProfile)]);
  };
  const updateCredential = (id: string, patch: Partial<Credential>) => {
    setVault((v) => v.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setProfiles((prev) =>
      prev.map((p) =>
        p.credentialId === id
          ? {
              ...p,
              name: patch.label ?? p.name,
              niche: patch.tag ?? p.niche,
              username: patch.username ?? p.username,
              password: patch.password ?? p.password,
            }
          : p,
      ),
    );
  };
  const deleteCredential = (id: string) => {
    setVault((v) => v.filter((c) => c.id !== id));
    setProfiles((prev) => prev.filter((p) => p.credentialId !== id));
    setSelectedIds((s) => {
      const next = new Set(s);
      for (const k of next) if (k.startsWith(`vault_${id}`)) next.delete(k);
      return next;
    });
  };

  // Virtualized grid
  const gridRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cardWidth = 110 + scale * 240;
  const cardHeight = scale < 0.35 ? 32 : scale < 0.7 ? 96 : 380;
  const gap = 8;

  const cols = Math.max(1, Math.floor((containerSize.w - 16) / (cardWidth + gap)));
  const rows = Math.ceil(visibleProfiles.length / cols);
  const totalHeight = rows * (cardHeight + gap);

  const overscan = 2;
  const startRow = Math.max(0, Math.floor(scrollTop / (cardHeight + gap)) - overscan);
  const visibleRowCount = Math.ceil(containerSize.h / (cardHeight + gap)) + overscan * 2;
  const endRow = Math.min(rows, startRow + visibleRowCount);

  const items: { profile: Profile; left: number; top: number }[] = [];
  for (let r = startRow; r < endRow; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= visibleProfiles.length) break;
      items.push({
        profile: visibleProfiles[idx],
        left: c * (cardWidth + gap),
        top: r * (cardHeight + gap),
      });
    }
  }

  const loggedInCount = profiles.filter((p) => p.loggedIn).length;
  const popoutCred = popoutCredId ? vault.find((c) => c.id === popoutCredId) : null;

  // Command runner
  const profilesByIdRef = useRef<Record<string, Profile>>({});
  profilesByIdRef.current = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);
  const adapter = ADAPTERS[adapterId];
  useCommandRunner(
    adapter,
    (id) => profilesByIdRef.current[id],
    (cmd, result) => {
      const p = profilesByIdRef.current[cmd.profileId];
      const name = p?.name ?? cmd.profileId;
      if (result === "succeeded") notify(`✓ Posted to ${name}`);
      else if (result === "failed") notify(`✕ Failed: ${name}`);
      else if (result === "awaiting") notify(`✋ Awaiting manual post: ${name}`);
    },
  );
  const commands = useCommands();
  const commandByProfile = useMemo(() => latestByProfile(commands), [commands]);
  const queueStats = useMemo(() => {
    const s = { queued: 0, running: 0, awaiting: 0, failed: 0 };
    for (const c of commands) {
      if (c.status === "queued") s.queued++;
      else if (c.status === "running") s.running++;
      else if (c.status === "awaiting") s.awaiting++;
      else if (c.status === "failed") s.failed++;
    }
    return s;
  }, [commands]);

  const onAdapterChange = (id: AdapterId) => {
    setAdapterId(id);
    saveAdapterId(id);
  };

  return (
    <div className="h-screen w-screen flex bg-background text-foreground overflow-hidden">
      <Sidebar
        profiles={profiles}
        activeGroup={activeGroup}
        onGroupChange={(k) => setActiveGroup(k)}
        onSelectGroup={selectGroup}
        keywords={keywordsRaw}
        onKeywordsChange={setKeywordsRaw}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {bannerOpen && (
          <div className="flex items-start gap-2 px-4 py-2 border-b border-border bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))] text-[11px]">
            <ShieldAlert className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold">Connection Guide:</span>{" "}
              Cross-origin policies block scripts from typing into external iframes. Use the{" "}
              <span className="font-mono">Copy User</span> / <span className="font-mono">Copy Pass</span>{" "}
              buttons on each card, or the <span className="font-mono">pop-out</span> window — a floating widget
              keeps your credentials visible for paste-authentication.
            </div>
            <button
              onClick={() => setBannerOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-input flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search profiles or usernames..."
              className="bg-transparent outline-none text-xs flex-1 font-mono"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ZoomIn className="h-3.5 w-3.5" />
            <span className="font-mono w-14">
              {scale < 0.35 ? "Compact" : scale < 0.7 ? "Medium" : "Phone"}
            </span>
            <input
              type="range" min={0} max={1} step={0.01} value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-48 accent-[var(--color-primary)]"
            />
          </div>

          <div className="text-xs font-mono">
            <span className="text-muted-foreground">{visibleProfiles.length}/{profiles.length}</span>
            <span className="ml-3" style={{ color: "oklch(0.72 0.18 150)" }}>● {loggedInCount} live</span>
            <span className="ml-3 text-primary">⚿ {vault.length} vault</span>
          </div>

          <button
            onClick={() => setVaultOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Vault
          </button>
        </header>

        {/* Platform quick-filter row */}
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-card/40">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">Filter</span>
          {PLATFORM_FILTERS.map(({ key, label, Icon }) => {
            const groupKey = key === "all" ? "all" : `platform:${key}`;
            const active = activeGroup === groupKey;
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(groupKey)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                  active ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent text-muted-foreground"
                }`}
                style={key !== "all" && !active ? { color: `var(--color-platform-${key})` } : undefined}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        <div
          ref={gridRef}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          className="flex-1 overflow-auto p-2"
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            {items.map(({ profile, left, top }) => (
              <div
                key={profile.id}
                style={{ position: "absolute", left, top, width: cardWidth, height: cardHeight }}
              >
                <ProfileCard
                  profile={profile}
                  scale={scale}
                  selected={selectedIds.has(profile.id)}
                  pulsing={pulsingIds.has(profile.id)}
                  keywords={keywords}
                  command={commandByProfile[profile.id]}
                  onToggleSelect={toggleSelect}
                  onDraftChange={onDraftChange}
                  onToggleView={onToggleView}
                  onFlag={onFlag}
                  onUrlChange={onUrlChange}
                  onToggleLogin={onToggleLogin}
                  onPopout={onPopout}
                  onNotify={notify}
                />
              </div>
            ))}
          </div>
        </div>
      </main>

      <CommandPanel
        profiles={visibleProfiles}
        selectedIds={selectedIds}
        bulkText={bulkText}
        setBulkText={setBulkText}
        onDistribute={distribute}
        onClearDrafts={clearDrafts}
        onClearAllDrafts={clearAllDrafts}
        onAppendHashtags={appendHashtags}
        onSelectAllVisible={selectAllVisible}
        onClearSelection={clearSelection}
        adapterId={adapterId}
        onAdapterChange={onAdapterChange}
        onOpenActivity={() => setActivityOpen(true)}
        queueStats={queueStats}
      />

      <VaultManager
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        vault={vault}
        onAdd={addCredential}
        onAddMany={addCredentials}
        onUpdate={updateCredential}
        onDelete={deleteCredential}
        notify={notify}
      />

      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        commands={commands}
        profilesById={profilesByIdRef.current}
      />

      {popoutCred && (
        <PopoutCredentialWidget
          label={popoutCred.label}
          username={popoutCred.username}
          password={popoutCred.password}
          onClose={() => setPopoutCredId(null)}
          notify={notify}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded bg-card border border-primary text-xs font-mono shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
