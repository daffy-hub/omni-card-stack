
# Guided Cycle Runner for TikTok (and beyond)

You picked the smart-manual path with one connection per profile. Real automated like/comment/DM isn't available on TikTok's API, but we can make the manual loop fast enough that posting 20 accounts feels like one continuous flow instead of 20 tabs.

## Honest constraint up front
A web app **cannot type into a TikTok tab it opened** — browsers block cross-origin DOM access for security. So "auto-fill" really means:
- Open the *exact* deep link for the action (compose page, specific video, DM thread).
- Copy the payload (caption, comment, DM body) to the clipboard automatically.
- Show a small floating coach card so the user just hits ⌘V → post → Done.

Real DOM auto-fill requires the browser extension (the existing `extension-bridge` seam). This plan keeps that door open for later but doesn't depend on it.

## What we'll build

### 1. New adapter: `guided-cycle` (replaces simple `manual-popout` as default)
Behavior per command:
1. Mark command `running`, then `awaiting`.
2. Copy `payload.text` (+ hashtags) to the clipboard.
3. Open a single reusable pop-out tab (`window.open(url, 'omni-cycle')`) — reusing the name means the *same* tab is reused across the whole cycle instead of spawning N tabs.
4. URL is resolved per `kind`:
   - `post` → `https://www.tiktok.com/upload` (or `tiktokstudio.com/upload`)
   - `comment` → `payload.targetUrl` (the video URL)
   - `dm` → `https://www.tiktok.com/messages?u=<username>`
   - `like` (new kind) → `payload.targetUrl`
5. App stays focused on a **Cycle HUD** (new component) showing: current profile, payload, "Open tab" / "Done" / "Skip" / "Fail" / "Pause".
6. On **Done**: mark `succeeded`, dequeue next command, repeat from step 2 — the pop-out tab navigates to the next URL automatically (same window name).
7. On **Fail**: prompt for reason, store in `lastError`, continue.
8. On **Pause**: stop the auto-advance; queue resumes when user clicks Resume.

### 2. New command kind: `like`
Add `like` to `CommandKind` and to the dispatch UI. Payload is just `{ targetUrl }`.

### 3. Per-command target URL
Today commands only carry `text`. Extend `CommandPayload`:
```ts
interface CommandPayload {
  text?: string;          // caption / comment / DM body
  hashtags?: string;
  targetUrl?: string;     // required for comment/dm/like
}
```
`CommandPanel` gains a small "Target URL" field that's only shown for non-post kinds, plus a kind selector (Post / Comment / DM / Like).

### 4. Cycle HUD component (`src/components/omni/CycleHud.tsx`)
Sticky bottom-right panel, only visible when `guided-cycle` is the active adapter AND there's an `awaiting` command. Shows:
- Profile name + niche
- Kind badge + payload preview (truncated)
- Big buttons: **Open / Re-open tab**, **Done (⏎)**, **Skip (S)**, **Fail (F)**, **Pause (Esc)**
- "Clipboard ready ✓" indicator
- Queue progress: "3 / 20"
- Keyboard shortcuts wired via `window.addEventListener('keydown')` so the user never leaves the keyboard.

### 5. Runner changes (`useCommandRunner.ts`)
- Already drains queue one-at-a-time → keep.
- Add a `resolveCommand(id, outcome)` API the HUD calls. This flips the `awaiting` row to `succeeded`/`failed`/`cancelled` and the existing tick picks up the next queued command.
- Add an in-memory "cycle session" flag so we don't accidentally re-open a fresh tab when the user already has the cycle tab open.

### 6. Small adapter cleanups
- Keep `simulated` for demos.
- Keep `extension-bridge` stub — it's the upgrade path for true auto-fill / auto-like.
- Remove the old one-shot `manual-popout` (or rename it to `guided-cycle` since the behavior is a strict superset).

## What this gives the user
- One tab, not 20.
- Caption/comment already in clipboard — ⌘V + send + ⏎ per item.
- ~2 sec per action instead of ~15.
- Honest status trail: every Done/Skip/Fail is recorded in the existing Activity drawer.
- Zero ToS risk: every action is still performed by a human in TikTok's own UI.

## Files touched
- `src/lib/commands.ts` — add `like` kind, extend payload with `targetUrl`
- `src/lib/command-adapters.ts` — new `guided-cycle` adapter, deprecate `manual-popout`
- `src/hooks/useCommandRunner.ts` — expose `resolveCommand`, single-tab reuse
- `src/components/omni/CycleHud.tsx` — new
- `src/components/omni/CommandPanel.tsx` — kind selector + targetUrl field
- `src/components/omni/Workspace.tsx` — mount `<CycleHud />`
- `src/components/omni/ActivityDrawer.tsx` — show kind + targetUrl

## Explicitly out of scope (call out)
- **Real DOM auto-fill / auto-click inside TikTok** — needs the companion Chrome extension. This plan keeps the `extension-bridge` seam intact so we can ship that next without touching the UI.
- **TikTok official posting API** — happy to add a second adapter `tiktok-api` later that handles `post` end-to-end via the connector gateway for accounts that are OAuth-linked. Say the word and I'll layer it in.
- **Scheduling** — easy once the queue is solid; not in this round.
