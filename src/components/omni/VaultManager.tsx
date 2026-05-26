import { useRef, useState } from "react";
import { Plus, Upload, X, Eye, EyeOff, Trash2, Copy, FileText, KeyRound } from "lucide-react";
import type { Platform } from "@/lib/mock-profiles";
import { PLATFORM_LOGIN_URL } from "@/lib/mock-profiles";
import { type Credential, parseBulk, newCredentialId } from "@/lib/vault";

interface Props {
  open: boolean;
  onClose: () => void;
  vault: Credential[];
  onAdd: (c: Credential) => void;
  onAddMany: (creds: Credential[]) => void;
  onUpdate: (id: string, patch: Partial<Credential>) => void;
  onDelete: (id: string) => void;
  notify: (msg: string) => void;
}

const PLATFORMS: Platform[] = ["tiktok"];

const SAMPLE = `- Platform: TikTok | Username: creator_01 | Password: passWord456 | Tag: Tech
- Platform: TikTok | Username: dance_guy | Password: securePass789 | Tag: Marketing
- Label: ClientA_TT_01 | Platform: TikTok | Username: hello@x.com | Password: hunter2 | Tag: Client A`;

export function VaultManager({ open, onClose, vault, onAdd, onAddMany, onUpdate, onDelete, notify }: Props) {
  const [tab, setTab] = useState<"add" | "import" | "table">("table");
  const [bulkText, setBulkText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual form
  const [label, setLabel] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tag, setTag] = useState("");

  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
  const [filterPlatform, setFilterPlatform] = useState<"all" | Platform>("all");

  if (!open) return null;

  const handleAdd = () => {
    if (!username.trim() || !password.trim()) {
      notify("Username & password required");
      return;
    }
    onAdd({
      id: newCredentialId(),
      label: label.trim() || `${platform}_${username.trim()}`,
      platform,
      username: username.trim(),
      password,
      tag: tag.trim() || "Manual",
      loginUrl: PLATFORM_LOGIN_URL[platform],
    });
    setLabel(""); setUsername(""); setPassword(""); setTag("");
    notify("Account added to vault");
  };

  const handleParse = () => {
    const parsed = parseBulk(bulkText);
    if (!parsed.length) {
      notify("No valid lines found");
      return;
    }
    onAddMany(parsed);
    setBulkText("");
    notify(`Imported ${parsed.length} accounts`);
    setTab("table");
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    setBulkText(text);
    setTab("import");
  };

  const filtered = filterPlatform === "all" ? vault : vault.filter((c) => c.platform === filterPlatform);

  const copy = async (val: string, kind: string) => {
    try {
      await navigator.clipboard.writeText(val);
      notify(`${kind} copied`);
    } catch {
      notify("Copy failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[720px] max-w-full h-full bg-card border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold flex-1">Credential Vault Manager</h2>
          <span className="text-[10px] text-muted-foreground font-mono">{vault.length} accounts</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex border-b border-border bg-background/40">
          {[
            { k: "table", label: "Vault", icon: KeyRound },
            { k: "add", label: "Manual Add", icon: Plus },
            { k: "import", label: "Bulk Import", icon: Upload },
          ].map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs border-b-2 transition-colors ${
                tab === k
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-auto p-4">
          {tab === "add" && (
            <div className="space-y-3 max-w-md">
              <Field label="Profile Label / Name">
                <input
                  value={label} onChange={(e) => setLabel(e.target.value)}
                  placeholder="TechBrand_Insta_04"
                  className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>
              <Field label="Platform">
                <select
                  value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
                  className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Login URL: {PLATFORM_LOGIN_URL[platform]}
                </div>
              </Field>
              <Field label="Username / Email">
                <input
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>
              <Field label="Tag / Folder">
                <input
                  value={tag} onChange={(e) => setTag(e.target.value)}
                  placeholder="Crypto Niche, Client A..."
                  className="w-full bg-input rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                />
              </Field>
              <button
                onClick={handleAdd}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Add account to vault
              </button>
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              >
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-xs">Drop a .md / .txt file or click to browse</div>
                <input
                  ref={fileRef} type="file" accept=".md,.txt,text/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Bulk text (Markdown / pipe-delimited)
                </label>
                <textarea
                  value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                  placeholder={SAMPLE}
                  className="mt-1 w-full h-64 resize-y bg-input rounded p-2 text-xs outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Recognized keys: Platform, Username, Password, Tag, Label · separators: | · prefixes: - * •
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleParse}
                  disabled={!bulkText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                >
                  <Upload className="h-4 w-4" /> Parse & Import
                </button>
                <button
                  onClick={() => setBulkText(SAMPLE)}
                  className="px-3 py-2 rounded bg-secondary text-xs hover:bg-accent"
                >
                  Load sample
                </button>
              </div>
            </div>
          )}

          {tab === "table" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(["all", ...PLATFORMS] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPlatform(p as typeof filterPlatform)}
                    className={`text-[10px] px-2 py-1 rounded font-mono uppercase tracking-wider ${
                      filterPlatform === p ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No credentials yet. Use Manual Add or Bulk Import.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5 px-2">Label</th>
                        <th className="text-left py-1.5 px-2">Platform</th>
                        <th className="text-left py-1.5 px-2">Username</th>
                        <th className="text-left py-1.5 px-2">Password</th>
                        <th className="text-left py-1.5 px-2">Tag</th>
                        <th className="py-1.5 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const reveal = revealMap[c.id];
                        return (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30">
                            <td className="py-1.5 px-2 font-mono truncate max-w-[160px]">{c.label}</td>
                            <td className="py-1.5 px-2">
                              <span
                                className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  background: `color-mix(in oklab, var(--color-platform-${c.platform}) 25%, transparent)`,
                                  color: `var(--color-platform-${c.platform})`,
                                }}
                              >
                                {c.platform}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-mono">
                              <div className="flex items-center gap-1">
                                <span className="truncate max-w-[140px]">{c.username}</span>
                                <button onClick={() => copy(c.username, "Username")} className="text-muted-foreground hover:text-primary">
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 font-mono">
                              <div className="flex items-center gap-1">
                                <span className="truncate max-w-[120px]">{reveal ? c.password : "••••••••"}</span>
                                <button
                                  onClick={() => setRevealMap((m) => ({ ...m, [c.id]: !m[c.id] }))}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button onClick={() => copy(c.password, "Password")} className="text-muted-foreground hover:text-primary">
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                value={c.tag}
                                onChange={(e) => onUpdate(c.id, { tag: e.target.value })}
                                className="w-24 bg-transparent border border-border rounded px-1 py-0.5 text-[10px] font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <button
                                onClick={() => onDelete(c.id)}
                                className="text-muted-foreground hover:text-destructive p-1"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
