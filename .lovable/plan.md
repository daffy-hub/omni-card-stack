
# Command Execution Pipeline

Today "Distribute" only writes text into per-card draft fields. There is no
queue, no status, no record of what was sent, and nothing actually leaves the
browser. This plan adds a real command layer that the UI dispatches into and
an executor consumes — designed so the executor can later be a TikTok API
worker or a browser extension without changing the UI contract.

## What we'll build

### 1. Command model (Lovable Cloud)
A `commands` table per user:

```text
id, user_id, profile_id, platform, kind ('post'|'comment'|'dm'…),
payload (jsonb: text, hashtags, mediaRefs),
status ('queued'|'running'|'succeeded'|'failed'|'cancelled'),
attempts, last_error, created_at, started_at, finished_at
```

RLS: owner-only CRUD. Realtime enabled so the UI updates live.

### 2. Dispatch path (frontend)
- `CommandPanel.onDistribute` no longer mutates `profile.draft`. It calls
  `enqueueCommands(selectedIds, spintax(bulkText), hashtags)` which inserts
  one row per selected profile with `status='queued'`.
- Each `ProfileCard` subscribes (via realtime) to its latest command and
  shows a status chip: queued / running / posted / failed + error tooltip.
- A new **Activity** drawer (toggle in header) lists recent commands with
  filter by status and a Retry button for failed ones.

### 3. Executor (pluggable)
A small dispatcher hook `useCommandRunner()` that:
1. Reads `queued` commands for the current user.
2. Marks one `running`, calls the active **adapter**, then writes the result.

Adapters (interface: `run(command, profile) => {ok, error?}`):
- **`simulated`** (default, ships now) — waits 600–1500 ms, randomly
  succeeds/fails, used so the whole lifecycle is observable end-to-end.
- **`manual-popout`** — opens the credential pop-out and the platform
  compose URL, then waits for the user to click "Mark posted" on the card.
- **`extension-bridge`** (stub) — posts a `window.postMessage` the future
  browser extension will pick up; logs a clear "no extension detected"
  error today.

Switching adapters is a single select in the header (persisted to
localStorage). This is the seam where a real TikTok API server function
plugs in later.

### 4. Recognition contract
Every command carries `{platform, kind, payload}`. The runner picks the
adapter, but adapters route on `platform+kind`, so adding "comment" or
"DM" later is just a new payload kind — no schema or UI rewrite.

## Out of scope (call out explicitly)
- Real TikTok posting — needs TikTok OAuth + API credentials; we'll wire
  the adapter once you decide between API vs. extension.
- Scheduling / cron — easy follow-up once the queue exists.
- Cross-device sync of drafts — implied free benefit once commands live in
  Cloud, but we'll keep current local draft editing as-is.

## Files touched
- `supabase/migrations/<ts>_commands.sql` — new
- `src/lib/commands.ts` — types, enqueue, subscribe (new)
- `src/lib/command-adapters/{simulated,manualPopout,extensionBridge}.ts` — new
- `src/hooks/useCommandRunner.ts` — new
- `src/components/omni/Workspace.tsx` — replace `distribute()`, mount runner
- `src/components/omni/CommandPanel.tsx` — adapter picker, queue stats
- `src/components/omni/ProfileCard.tsx` — status chip
- `src/components/omni/ActivityDrawer.tsx` — new

## Auth note
Commands are per-user, so this also introduces email/password auth
(required for RLS). If you'd rather keep it anonymous for now, we can
gate behind a single shared "workspace" row instead — say the word.
