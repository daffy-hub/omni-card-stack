export type Platform = "tiktok";
export type Status = "idle" | "selected" | "filled" | "flagged";

export interface Profile {
  id: string;
  name: string;
  platform: Platform;
  niche: string;
  tags: string[];
  status: Status;
  draft: string;
  followers: number;
  viewMode: "form" | "embed";
  loginUrl: string;   // platform default authentication URL
  currentUrl: string; // current iframe target (user-editable)
  loggedIn: boolean;  // manual "Logged In & Active" toggle
  credentialId?: string; // links to Credential in vault
  username?: string;     // cached for one-click copy in card header
  password?: string;
}

const niches = ["Crypto", "E-commerce", "Tech", "Local Clients", "Fashion", "Fitness"];
const regions = ["US", "UK", "EU", "APAC", "LATAM"];
const brands = ["Nova", "Helix", "Orbit", "Pulse", "Vertex", "Lumen", "Forge", "Drift"];

export const PLATFORM_LOGIN_URL: Record<Platform, string> = {
  tiktok: "https://www.tiktok.com/login",
};

// Deterministic pseudo-random so SSR and client match (no hydration mismatch)
function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function generateProfiles(): Profile[] {
  const profiles: Profile[] = [];
  const loginUrl = PLATFORM_LOGIN_URL.tiktok;
  for (let i = 0; i < 100; i++) {
    const brand = brands[i % brands.length];
    const region = regions[i % regions.length];
    const niche = niches[i % niches.length];
    const num = String(i + 1).padStart(3, "0");
    profiles.push({
      id: `p_${i}`,
      name: `${brand}_${num}_${region}_tt`,
      platform: "tiktok",
      niche,
      tags: [niche, region, "tiktok"],
      status: "idle",
      draft: "",
      followers: Math.floor(1000 + seeded(i + 1) * 500000),
      viewMode: "embed",
      loginUrl,
      currentUrl: loginUrl,
      loggedIn: false,
    });
  }
  return profiles;
}

// Spintax: "Hello {team|friends|folks}" -> random pick per call
export function spintax(input: string): string {
  const re = /\{([^{}]+)\}/;
  let out = input;
  let guard = 0;
  while (re.test(out) && guard++ < 50) {
    out = out.replace(re, (_, group: string) => {
      const opts = group.split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
  }
  return out;
}

export interface SeoResult {
  score: number; // 0..100
  tier: "red" | "yellow" | "green";
  reasons: string[];
}

const platformLimits: Record<Platform, { ideal: [number, number]; max: number }> = {
  tiktok: { ideal: [80, 1500], max: 2200 },
};

export function scoreSeo(text: string, platform: Platform, keywords: string[]): SeoResult {
  const reasons: string[] = [];
  if (!text.trim()) return { score: 0, tier: "red", reasons: ["empty"] };

  let score = 0;
  const len = text.length;
  const lim = platformLimits[platform];

  if (len > lim.max) {
    score += 5;
    reasons.push(`over ${lim.max}ch`);
  } else if (len >= lim.ideal[0] && len <= lim.ideal[1]) {
    score += 40;
  } else if (len < lim.ideal[0]) {
    score += Math.round((len / lim.ideal[0]) * 30);
    reasons.push("too short");
  } else {
    score += 25;
    reasons.push("a bit long");
  }

  const tags = (text.match(/#\w+/g) || []).length;
  if (tags === 0) {
    score += 5;
    reasons.push("no hashtags");
  } else if (tags >= 2 && tags <= 3) {
    score += 30;
  } else if (tags === 1 || tags === 4 || tags === 5) {
    score += 18;
  } else if (tags >= 6) {
    score += 4;
    reasons.push("hashtag spam");
  }

  const lower = text.toLowerCase();
  const hits = keywords.filter((k) => k && lower.includes(k.toLowerCase())).length;
  if (keywords.length > 0) {
    score += Math.min(30, hits * 12);
    if (hits === 0) reasons.push("no target keywords");
  } else {
    score += 15;
  }

  score = Math.max(0, Math.min(100, score));
  const tier: SeoResult["tier"] = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  return { score, tier, reasons };
}
