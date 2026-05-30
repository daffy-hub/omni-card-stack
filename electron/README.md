# OmniSocial — Desktop runner (Electron + Playwright)

The web app runs as a normal SPA at https://*.lovable.app. To get **real
per-profile isolation** (separate cookies, localStorage, IndexedDB, history,
cache) and **auto-actions** for likes/comments/DMs/posts, run the same UI
inside this Electron shell. Each profile gets its own Chromium
`userDataDir`, so nothing leaks between accounts.

## Architecture

```
Renderer (existing React UI)
   │  window.omni.*  (preload.cjs → contextBridge)
   ▼
Main process (main.cjs)
   ├── playwright-manager.cjs   one persistent Chromium ctx per profile
   ├── session-vault.cjs        snapshot/hydrate cookies+LS+IDB, encrypted
   └── cloud-sync.cjs           push/pull encrypted blobs to Lovable Cloud
```

## One-time install

```bash
npm i -D electron @electron/packager playwright
npx playwright install chromium
```

Then add to `package.json`:

```jsonc
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron:dev":   "OMNI_DEV_URL=http://localhost:8080 electron .",
    "electron:build": "vite build --base=./ && electron .",
    "electron:pack":  "vite build --base=./ && electron-packager . OmniSocial --platform=darwin --arch=x64 --out=electron-release --overwrite --ignore='^/src' --ignore='^/public'"
  }
}
```

> Note: `--base=./` is required so the built `index.html` resolves assets
> under `file://`. Don't change the project's `vite.config.ts` default —
> that build still targets Cloudflare Workers for the web preview.

## Dev loop

```bash
npm run dev               # in one terminal — Vite at :8080
npm run electron:dev      # in another — Electron window pointing at it
```

## Production build

```bash
npm run electron:pack     # outputs electron-release/OmniSocial-darwin-x64/
```

Cross-compile by changing `--platform=linux|darwin|win32`.

## How isolation works

`chromium.launchPersistentContext(userDataDir)` with a per-profile
directory under `app.getPath("userData")/sessions/<profileId>/`. That single
flag isolates **everything** the browser stores: cookies, localStorage,
sessionStorage, IndexedDB, service workers, cache, and history. No two
profiles can see each other's data even though they're driven by the same
app.

## How sync works

`session-vault.snapshot()` packs the auth-bearing files into one JSON blob,
encrypts it (prefers Electron's `safeStorage` which delegates to the OS
keychain; falls back to AES-256-GCM with a device-local key), and
`cloud-sync.push()` POSTs the ciphertext to the `putProfileSession`
TanStack server fn. The Cloud only ever sees encrypted bytes.

On another machine, `restoreProfile` pulls the row, decrypts it, writes the
files back into the `userDataDir`, and the next launch is signed in.

## Updating selectors

TikTok changes its DOM regularly. All selectors live in one file:
`electron/tiktok-selectors.cjs`. Patch that file (no rebuild of the
renderer required) and ship a new desktop release.

## Out of scope (by design)

- iOS/Android. Desktop only.
- Auto-solving captchas. The Chromium window is visible — solve manually.
- Bypassing TikTok rate limits or shadow-bans. Throttle yourself.
- An in-app video editor. `payload.mediaPath` points at a file you already have.