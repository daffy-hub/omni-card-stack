import { memo, useMemo, useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, RotateCw, FileEdit, Globe, Copy, Check, KeyRound } from "lucide-react";
import { scoreSeo, type Profile } from "@/lib/mock-profiles";
import { TikTokIcon } from "./TikTokIcon";

const platformIcon = {
  tiktok: TikTokIcon,
};

interface Props {
  profile: Profile;
  scale: number;
  selected: boolean;
  pulsing?: boolean;
  keywords: string[];
  onToggleSelect: (id: string) => void;
  onDraftChange: (id: string, value: string) => void;
  onToggleView: (id: string) => void;
  onFlag: (id: string) => void;
  onUrlChange: (id: string, url: string) => void;
  onToggleLogin: (id: string) => void;
  onPopout: (id: string) => void;
  onNotify?: (msg: string) => void;
}

function SeoRing({ score, tier }: { score: number; tier: "red" | "yellow" | "green" }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className={`relative inline-flex items-center justify-center seo-ring-${tier}`} title={`SEO ${score}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" fill="none" />
        <circle cx="12" cy="12" r={r} stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[8px] font-mono font-bold">{score}</span>
    </div>
  );
}

function ProfileCardImpl({
  profile, scale, selected, pulsing, keywords,
  onToggleSelect, onDraftChange, onToggleView, onFlag, onUrlChange, onToggleLogin, onPopout, onNotify,
}: Props) {
  const Icon = platformIcon[profile.platform];
  const compact = scale < 0.35;
  const medium = scale >= 0.35 && scale < 0.7;
  const large = scale >= 0.7;
  const hasCreds = !!(profile.username && profile.password);
  const [copied, setCopied] = useState<"u" | "p" | null>(null);

  const copyCred = async (kind: "u" | "p") => {
    const val = kind === "u" ? profile.username : profile.password;
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopied(kind);
      onNotify?.(`${kind === "u" ? "Username" : "Password"} copied · ${profile.name}`);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      onNotify?.("Copy failed");
    }
  };



  const [urlDraft, setUrlDraft] = useState(profile.currentUrl);
  const [iframeKey, setIframeKey] = useState(0);
  useEffect(() => { setUrlDraft(profile.currentUrl); }, [profile.currentUrl]);

  const seo = useMemo(
    () => scoreSeo(profile.draft, profile.platform, keywords),
    [profile.draft, profile.platform, keywords]
  );

  // Glow priority: pulse > flagged > selected > loggedIn(green) > needs-login(red)
  const glow = pulsing
    ? "pulse-push"
    : profile.status === "flagged"
    ? "glow-flagged"
    : selected
    ? "glow-selected"
    : profile.loggedIn
    ? "glow-authenticated"
    : "glow-needs-login";

  if (compact) {
    return (
      <button
        onClick={() => onToggleSelect(profile.id)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md bg-card text-left w-full ${glow} transition-shadow`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `var(--color-platform-${profile.platform})` }} />
        <span className="text-[11px] truncate flex-1 font-mono">{profile.name}</span>
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: profile.loggedIn ? "oklch(0.72 0.18 150)" : "var(--color-status-flagged)" }}
          title={profile.loggedIn ? "Logged in" : "Needs login"}
        />
        {profile.status === "flagged" && <AlertTriangle className="h-3 w-3 text-destructive" />}
      </button>
    );
  }

  const submitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let u = urlDraft.trim();
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    onUrlChange(profile.id, u || profile.loginUrl);
    setIframeKey((k) => k + 1);
  };

  return (
    <div className={`rounded-lg bg-card flex flex-col overflow-hidden ${glow} transition-shadow`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(profile.id)}
          className="h-3.5 w-3.5 accent-[var(--color-primary)]"
        />
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `var(--color-platform-${profile.platform})` }} />
        <span className="text-[11px] font-mono truncate flex-1">{profile.name}</span>
        <SeoRing score={seo.score} tier={seo.tier} />
        <button
          onClick={() => onPopout(profile.id)}
          className="text-muted-foreground hover:text-primary"
          title="Pop-out login window"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onToggleView(profile.id)}
          className="text-muted-foreground hover:text-foreground"
          title={profile.viewMode === "form" ? "Switch to web frame" : "Switch to compose form"}
        >
          {profile.viewMode === "form" ? <Globe className="h-3.5 w-3.5" /> : <FileEdit className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => onFlag(profile.id)}
          className="text-muted-foreground hover:text-destructive"
          title="Toggle flag"
        >
          <AlertTriangle className="h-3 w-3" />
        </button>
      </div>

      {/* Login Assistant Tool — visible whenever credentials are loaded */}
      {hasCreds && (medium || large) && (
        <div className="flex items-stretch gap-1 px-1.5 py-1 bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))] border-b border-border">
          <KeyRound className="h-3 w-3 text-primary self-center shrink-0" />
          <button
            onClick={() => copyCred("u")}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] px-1.5 py-1 rounded bg-secondary hover:bg-accent font-mono"
            title={profile.username}
          >
            {copied === "u" ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            Copy User
          </button>
          <button
            onClick={() => copyCred("p")}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] px-1.5 py-1 rounded bg-secondary hover:bg-accent font-mono"
            title="Copy password"
          >
            {copied === "p" ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            Copy Pass
          </button>
        </div>
      )}

      {medium && (
        <div className="p-2 text-[10px] text-muted-foreground flex items-center justify-between">
          <span className="uppercase tracking-wide truncate">{profile.niche}</span>
          <span className="font-mono">
            {profile.loggedIn ? "● live" : "○ needs login"}
          </span>
        </div>
      )}

      {large && (
        <div className="flex-1 flex flex-col">
          {profile.viewMode === "embed" ? (
            <>
              {/* URL bar */}
              <form onSubmit={submitUrl} className="flex items-center gap-1 px-1.5 py-1 bg-input border-b border-border">
                <button
                  type="button"
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  title="Reload frame"
                >
                  <RotateCw className="h-3 w-3" />
                </button>
                <input
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder={profile.loginUrl}
                  className="flex-1 bg-transparent outline-none text-[10px] font-mono truncate"
                />
              </form>

              {/* Iframe viewport */}
              <div className="flex-1 min-h-[120px] bg-input relative">
                <iframe
                  key={iframeKey}
                  src={profile.currentUrl}
                  title={profile.name}
                  className="absolute inset-0 w-full h-full bg-white"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* Subtle X-Frame-Options fallback hint */}
                <div className="pointer-events-none absolute bottom-1 right-1 text-[8px] font-mono text-muted-foreground bg-background/70 px-1 rounded">
                  if blank → use pop-out ↗
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col p-2 gap-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wide">{profile.niche}</span>
                <span className="font-mono">{profile.draft.length}ch</span>
              </div>
              <textarea
                value={profile.draft}
                onChange={(e) => onDraftChange(profile.id, e.target.value)}
                placeholder="Compose post..."
                className="flex-1 min-h-[70px] resize-none bg-input text-foreground text-xs rounded p-2 outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <div className={`text-[10px] font-mono seo-ring-${seo.tier}`}>
                SEO {seo.score} {seo.reasons[0] ? `· ${seo.reasons[0]}` : ""}
              </div>
            </div>
          )}

          {/* Persistent login status checkbox */}
          <label className="flex items-center gap-2 px-2 py-1.5 border-t border-border bg-card text-[10px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={profile.loggedIn}
              onChange={() => onToggleLogin(profile.id)}
              className="h-3.5 w-3.5 accent-[var(--color-primary)]"
            />
            <span
              className="font-mono uppercase tracking-wider"
              style={{ color: profile.loggedIn ? "oklch(0.72 0.18 150)" : "var(--color-status-flagged)" }}
            >
              {profile.loggedIn ? "Logged in & active" : "Needs login"}
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

export const ProfileCard = memo(ProfileCardImpl);
