
# Per-profile isolated browsers + Playwright auto-actions

You want each profile to behave like a separate browser install (its own cookies, localStorage, IndexedDB, cache, history), with TikTok actions driven automatically and the encrypted session jars synced to Lovable Cloud so the same roster works from another machine.

A regular webpage can't do that — browsers share storage across tabs of the same origin. So we wrap the existing web UI in **Electron** and use **Playwright** to drive a fresh isolated Chromium context per profile.

## Architecture

```text
 ┌──────────────────────────────────────────────────────────┐
 │  Electron app (desktop)                                  │
 │  ┌────────────────────┐    ┌──────────────────────────┐  │
 │  │ Renderer (current  │◀──▶│ Main process             │  │
 │  │ React web UI)      │IPC │  • Playwright manager    │  │
 │  │ CommandPanel/HUD   │    │  • Session vault (local) │  │
 │  └────────────────────┘    │  • Cloud sync worker     │  │
 │                            └──────────┬───────────────┘  │
 │                                       │ launches         │
 │  ┌────────────────────┐               ▼                  │
 │  │ Chromium ctx #1    │  ┌────────────────────────────┐  │
 │  │ userDataDir =      │  │ Chromium ctx #N            │  │
 │  │ sessions/<id-1>/   │  │ sessions/<id-N>/           │  │
 │  │  cookies+LS+IDB    │  │  cookies+LS+IDB            │  │
 │  └────────────────────┘  └────────────────────────────┘  │
 └─────────────────────────────────┬────────────────────────┘
                                   │ HTTPS (encrypted blobs)
                                   ▼
                       ┌────────────────────────┐
                       │ Lovable Cloud          │
                       │  profile_sessions      │
                       │  (RLS, AES-GCM blob)   │
                       └────────────────────────┘
```

Each profile gets its own `userDataDir` on disk — that single flag gives complete isolation of cookies, localStorage, IndexedDB, service workers, cache, and history. Nothing leaks between profiles.

## Phase 1 — Electron shell

- Add Electron in this repo (`electron/main.cjs`, `electron/preload.cjs`).
- Set Vite `base: './'` so the built bundle loads under `file://`.
- The renderer is the existing TanStack app, unchanged. A new preload exposes `window.omni.*` IPC: `launchProfile`, `runAction`, `closeProfile`, `listSessions`, `syncProfile`.
- Package via `@electron/packager` (works in this sandbox; electron-builder doesn't).
- Detect Electron at runtime in the web UI — when present, the Cycle HUD calls `window.omni.*` instead of `window.open()`. When absent (browser preview), fall back to today's `guided-cycle` adapter so dev preview still works.

## Phase 2 — Playwright session manager

In the main process:

- One `playwright.chromium.launchPersistentContext(userDataDir)` per profile, kept warm in a Map keyed by `profileId`.
- `userDataDir = app.getPath('userData') + '/sessions/<profileId>'`.
- Headed by default (so the user can intervene/solve captchas); headless toggle in settings.
- Each context tagged with a realistic UA + viewport (carried on the `Profile` record).
- Lifecycle: lazy-launch on first action for a profile; idle-evict after N minutes to cap memory.

## Phase 3 — Auto-action adapter

New adapter `playwright-desktop` (replaces nothing — sits alongside `guided-cycle` and `simulated`):

- `post` → opens `tiktokstudio.com/upload`, attaches video file from `payload.mediaPath`, fills caption, clicks Post.
- `comment` → opens `payload.targetUrl`, opens comments panel, fills + submits.
- `like` → opens `payload.targetUrl`, clicks the like button.
- `dm` → opens `messages?u=<username>`, fills + sends.

Selectors live in a single `tiktok-selectors.ts` file so they're easy to patch when TikTok ships UI changes. Every action wraps in try/catch and:
- If logged out → mark `awaiting`, surface "Sign in to <profile>" in the HUD; user signs in once inside that Chromium context, cookies persist forever after.
- If captcha detected → mark `awaiting`, prompt user to solve in the open window, click Resume.
- If selector miss → fail with a clear "TikTok UI changed, update selectors" error.

The runner's existing `awaiting` flow already handles this — no changes needed to `useCommandRunner.ts` shape, just a new adapter that can return `{ awaiting: true }`.

## Phase 4 — Cloud sync of session vaults

A profile's session = `cookies.json` + `localStorage.json` + `indexedDB` dump from its `userDataDir`. We don't sync the full Chromium profile (too big, contains caches); we sync just the auth-bearing pieces.

Schema (one new table):

```sql
profile_sessions (
  id uuid pk,
  user_id uuid not null,                 -- owner
  profile_id text not null,              -- matches local profile id
  encrypted_blob bytea not null,         -- AES-GCM(cookies+LS+IDB)
  blob_iv bytea not null,
  device_id text not null,               -- last writer
  updated_at timestamptz,
  unique(user_id, profile_id)
)
```

- RLS: `user_id = auth.uid()`.
- Encryption key derived from a passphrase the user sets once on first launch (PBKDF2 → AES-GCM). Cloud only ever sees ciphertext.
- Sync triggers: after each successful action, debounced 30s; on app quit; manual "Sync now" button.
- Pull on launch: if local is missing or older than remote, hydrate `userDataDir` from the decrypted blob before launching the context.
- Conflict policy: last-writer-wins, with a `device_id` warning in the UI if two devices wrote within 5 minutes.

## Phase 5 — UI updates

- `CommandPanel`: add executor option **"Desktop (Playwright)"**, disabled with tooltip when not running in Electron.
- `ProfileCard`: small status dot — `synced` / `local-only` / `cloud-only` / `conflict`.
- New `SessionVault` page (per-profile): last sync time, device that wrote it, "Re-login", "Wipe local session", "Restore from cloud".
- `CycleHud`: when desktop adapter is active, replace "Open tab / Done" with live status from Playwright (`Logging in…`, `Posting…`, `Solving captcha?`).

## Out of scope (call out explicitly)

- **iOS/Android.** Desktop only.
- **Mass automation that violates TikTok ToS.** This will work technically, and TikTok will rate-limit / shadow-ban accounts that behave like bots. We'll add throttles + jitter, but the risk is on you.
- **Auto-solving captchas.** User solves them in the open window.
- **In-app video editor.** `payload.mediaPath` points at a file the user already has on disk.

## Technical details

- **Files added**: `electron/main.cjs`, `electron/preload.cjs`, `electron/playwright-manager.ts`, `electron/session-vault.ts`, `electron/cloud-sync.ts`, `electron/tiktok-selectors.ts`, `src/lib/electron-bridge.ts`, `src/lib/command-adapters.ts` (+`playwright-desktop`), `src/components/omni/SessionVault.tsx`, `src/routes/sessions.tsx`.
- **Files edited**: `package.json` (electron, @electron/packager, playwright deps + `main` field + scripts), `vite.config.ts` (`base: './'`), `CommandPanel.tsx`, `CycleHud.tsx`, `ProfileCard.tsx`, `Workspace.tsx`.
- **DB migration**: `profile_sessions` table + RLS + GRANTs + updated_at trigger.
- **Server fn**: `getProfileSession` / `putProfileSession` (auth-required, just shuttles ciphertext).
- **Packaging**: `npx vite build && npx @electron/packager . OmniSocial --platform=<linux|darwin|win32> --arch=x64 --out=electron-release --overwrite`.
- **Ships as**: `.tar.gz` (Linux), `.zip` (macOS, Windows) — `.dmg` / `.exe` installers aren't possible from this sandbox.

## Suggested build order

1. Electron shell + base path fix + `window.omni` IPC stub. Verify the existing UI loads in a desktop window.
2. Playwright manager + `playwright-desktop` adapter for `like` only (smallest end-to-end slice).
3. Add `post`, `comment`, `dm`.
4. Local session vault (no cloud yet).
5. DB migration + encrypted cloud sync.
6. UI polish: SessionVault page, ProfileCard status, HUD live status.
