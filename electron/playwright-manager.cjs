/* eslint-disable */
// One persistent Chromium context per profile = isolated cookies + localStorage + IndexedDB + history.
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const selectors = require("./tiktok-selectors.cjs");

let chromium = null;
try { ({ chromium } = require("playwright")); } catch {}

const contexts = new Map(); // profileId -> { ctx, page, lastUsed }
const IDLE_MS = 15 * 60 * 1000;

function userDataDirFor(profileId) {
  const root = path.join(app.getPath("userData"), "sessions", profileId);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

// Resolve unpacked Chromium extensions to load into every profile context.
// ProtonVPN (and any other extension) goes in:
//   <userData>/extensions/<extension-folder>/   (unpacked, contains manifest.json)
// or override with env OMNI_EXTENSIONS_DIR / OMNI_PROTONVPN_PATH.
function resolveExtensionPaths() {
  const paths = [];
  const explicit = process.env.OMNI_PROTONVPN_PATH;
  if (explicit && fs.existsSync(path.join(explicit, "manifest.json"))) {
    paths.push(explicit);
  }
  const dir = process.env.OMNI_EXTENSIONS_DIR
    || path.join(app.getPath("userData"), "extensions");
  try {
    if (fs.existsSync(dir)) {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()
            && fs.existsSync(path.join(full, "manifest.json"))
            && !paths.includes(full)) {
          paths.push(full);
        }
      }
    }
  } catch (e) {
    console.warn("[omni] extension scan failed:", e?.message);
  }
  return paths;
}

async function launchProfile(profileId) {
  if (!chromium) return { ok: false, error: "Playwright not installed. Run: npm i -D playwright && npx playwright install chromium" };
  if (contexts.has(profileId)) {
    contexts.get(profileId).lastUsed = Date.now();
    return { ok: true };
  }
  try {
    const extensions = resolveExtensionPaths();
    const extArgs = extensions.length
      ? [
          `--disable-extensions-except=${extensions.join(",")}`,
          `--load-extension=${extensions.join(",")}`,
        ]
      : [];
    const ctx = await chromium.launchPersistentContext(userDataDirFor(profileId), {
      // Loading unpacked extensions requires headed Chromium (channel: chrome
      // gives a real Chrome build that supports MV3 extensions reliably).
      headless: false,
      channel: extensions.length ? "chrome" : undefined,
      args: extArgs,
      viewport: { width: 412, height: 915 }, // phone-ish
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    });
    const page = ctx.pages()[0] || (await ctx.newPage());
    contexts.set(profileId, { ctx, page, lastUsed: Date.now() });
    ctx.on("close", () => contexts.delete(profileId));
    return { ok: true, extensions: extensions.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function runAction(cmd, profile) {
  const entry = contexts.get(profile.id);
  if (!entry) return { ok: false, error: "Profile context not launched" };
  entry.lastUsed = Date.now();
  const { page } = entry;

  try {
    const url = resolveUrl(cmd, profile);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Logged-out detection — pause and let user sign in once; cookies persist.
    if (await page.locator(selectors.loginIndicator).count() > 0) {
      return { ok: false, awaiting: true, status: "needs-login" };
    }
    // Captcha detection
    if (await page.locator(selectors.captcha).count() > 0) {
      return { ok: false, awaiting: true, status: "needs-captcha" };
    }

    switch (cmd.kind) {
      case "like":   return await selectors.doLike(page);
      case "comment":return await selectors.doComment(page, cmd.payload.text || "");
      case "dm":     return await selectors.doDm(page, cmd.payload.text || "");
      case "post":   return await selectors.doPost(page, cmd.payload);
      default:       return { ok: false, error: `Unsupported kind: ${cmd.kind}` };
    }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function resolveUrl(cmd, profile) {
  const t = cmd.payload?.targetUrl?.trim();
  if (t) return t;
  if (cmd.kind === "post") return "https://www.tiktok.com/tiktokstudio/upload";
  if (cmd.kind === "dm") {
    const u = (profile.username || "").replace(/^@/, "");
    return u ? `https://www.tiktok.com/messages?u=${encodeURIComponent(u)}` : "https://www.tiktok.com/messages";
  }
  return profile.currentUrl || profile.loginUrl || "https://www.tiktok.com/";
}

async function closeProfile(profileId) {
  const entry = contexts.get(profileId);
  if (!entry) return;
  try { await entry.ctx.close(); } catch {}
  contexts.delete(profileId);
}

function listSessions() {
  return Array.from(contexts.keys());
}

async function disposeAll() {
  for (const id of Array.from(contexts.keys())) await closeProfile(id);
}

// Idle eviction
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of contexts) {
    if (now - entry.lastUsed > IDLE_MS) closeProfile(id);
  }
}, 60_000);

module.exports = { launchProfile, runAction, closeProfile, listSessions, disposeAll };