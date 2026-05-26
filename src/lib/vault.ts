import type { Platform, Profile } from "./mock-profiles";
import { PLATFORM_LOGIN_URL } from "./mock-profiles";

export interface Credential {
  id: string;
  label: string;
  platform: Platform;
  username: string;
  password: string;
  tag: string;
  loginUrl: string;
}

export const VAULT_KEY = "omni:vault:v1";

export function loadVault(): Credential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Credential[];
    // Normalize legacy entries (instagram/twitter/etc.) to the only supported platform.
    return parsed.map((c) => ({
      ...c,
      platform: "tiktok" as Platform,
      loginUrl: PLATFORM_LOGIN_URL.tiktok,
    }));
  } catch {
    return [];
  }
}

export function saveVault(v: Credential[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  } catch {}
}

export function newCredentialId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const PLATFORM_ALIASES: Record<string, Platform> = {
  tiktok: "tiktok",
  tt: "tiktok",
  "tik tok": "tiktok",
};

function normalizePlatform(s: string): Platform {
  const k = s.trim().toLowerCase();
  return PLATFORM_ALIASES[k] ?? "tiktok";
}

/**
 * Parse bulk markdown / text. Recognizes lines such as:
 *   - Platform: Instagram | Username: user123 | Password: passWord456 | Tag: Tech
 *   * Label: TechBrand_04 | Platform: X | Username: tech | Password: pwd | Tag: Marketing
 * Order of keys is flexible. Lines without "Username:" or "Password:" are skipped.
 */
export function parseBulk(text: string): Credential[] {
  const out: Credential[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^[-*•]\s*/, "");
    const segments = line.split("|").map((s) => s.trim()).filter(Boolean);
    const map: Record<string, string> = {};
    for (const seg of segments) {
      const m = seg.match(/^([A-Za-z][A-Za-z _-]*)\s*[:=]\s*(.+)$/);
      if (m) map[m[1].trim().toLowerCase()] = m[2].trim();
    }
    const username = map["username"] || map["user"] || map["email"];
    const password = map["password"] || map["pass"] || map["pwd"];
    if (!username || !password) continue;
    const platform = normalizePlatform(map["platform"] || map["network"] || "twitter");
    const label = map["label"] || map["name"] || map["profile"] || `${platform}_${username}`;
    const tag = map["tag"] || map["folder"] || map["niche"] || "Imported";
    out.push({
      id: newCredentialId(),
      label,
      platform,
      username,
      password,
      tag,
      loginUrl: PLATFORM_LOGIN_URL[platform],
    });
  }
  return out;
}

export function credentialToProfile(c: Credential): Profile {
  return {
    id: `vault_${c.id}`,
    name: c.label,
    platform: c.platform,
    niche: c.tag || "Vault",
    tags: [c.tag, c.platform],
    status: "idle",
    draft: "",
    followers: 0,
    viewMode: "embed",
    loginUrl: c.loginUrl,
    currentUrl: c.loginUrl,
    loggedIn: false,
    credentialId: c.id,
    username: c.username,
    password: c.password,
  };
}
