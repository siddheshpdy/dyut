# CrazyGames Selected Features — Execution Plans

**Scope:** features 1–4, 6, 7, and 9 selected from the CrazyGames feature list.

This document defines the implementation order for the selected portal work. It
does not alter Dyut's dice, movement, combat, or victory rules.

## 1. Instant Multiplayer and Room Matchmaking

**Baseline:** invite parsing, join listeners, private lobby creation, native
invite links, and `updateRoom` capacity updates are present.

1. Add browser coverage for boot-time invites, join listeners, private rooms,
   capacity updates, and room-close paths. **Why:** SDK paths need browser-level
   verification, not only reducer tests.
2. Derive room capacity from claimed human seats and lock the room at start.
   **Why:** invites must not target a non-joinable match.
3. Verify host migration and bot-fill fallback. **Why:** a disconnect must not
   leave a match unplayable.

**Acceptance:** an invite opens its lobby; a private room reports capacity,
locks on start, and calls `leftRoom` when abandoned.

## 2. Fast First-Session Onboarding

**Baseline:** a new signed-in portal user is routed into a local bot match;
resumes and incoming invites take priority.

1. Test first-session detection with mocked CrazyGames Data. **Why:** a saved
   game or invitation must never be overridden.
2. Test the menu-to-bot-board transition. **Why:** portal users need an
   immediate first action.
3. Keep onboarding configuration separate from game rules. **Why:** portal UX
   must not silently modify Void Rule, spawn, or movement behavior.

**Acceptance:** onboarding runs once for a new portal user and is skipped for
resumes, invites, and non-portal builds.

## 3. Bot Fallback

**Baseline:** heuristic bots, host-only online bot control, AFK takeover, and
short bot-roll fallback are present.

1. Retain host-only bot dispatch in online matches. **Why:** two clients
   writing bot actions would race in RTDB.
2. Cover bot-filled seats, AFK takeover, and timeout recovery. **Why:** these
   are the conditions where the fallback matters.
3. Keep actions constrained by `gameLogic.js`. **Why:** bots must obey Dyut's
   move-priority and combat rules.

**Acceptance:** bot seats roll without the human timeout, only the host
auto-controls online bots, and bot moves are legal.

## 4. Free Instant Multiplayer

**Baseline:** an Instant Multiplayer launch creates a private 1v1 lobby and
bypasses portal onboarding.

1. Test that the launch has no entry, ad, purchase, or balance gate. **Why:**
   the sponsored portal queue must remain playable.
2. Test private-lobby creation and one-time launch consumption. **Why:** the
   party stays together and remounts do not create duplicate rooms.

**Acceptance:** one launch opens exactly one free private room with no menu or
onboarding detour.

## 6. Portal-Safe Ads

**Baseline:** midgame and banner calls are gated by `VITE_CG_ENABLE_ADS`; Basic
Launch sets that flag to `false`.

1. Test Basic Launch's no-ad path and mocked enabled-ad path. **Why:** Basic
   Launch must neither render a broken control nor request an ad.
2. Keep requests to natural breaks and reserved desktop lobby space. **Why:**
   ads must not interrupt active turns or cover controls.
3. Restore effective audio state after finish and error callbacks. **Why:**
   portal mute compliance must survive the ad lifecycle.
4. Defer rewarded coin grants to trusted backend settlement. **Why:** client
   callbacks cannot securely credit currency.

**Acceptance:** disabled builds make no requests or ad containers; enabled SDK
mocks use only permitted placements and restore audio.

## 7. Free and Earned Cosmetics

**Baseline:** pieces use unique seat colors; this worktree has no catalog,
inventory, selector, or store.

1. Add a small code-owned free and progression-earned piece-design catalog with
   per-profile selection. **Why:** portal personalization can reward play
   without insecure currency state.
2. Persist the design through lobby/match snapshots while retaining seat color
as the mandatory identity layer. **Why:** duplicate designs remain readable.
3. Add an accessible profile selector. **Why:** players need a discoverable,
mobile-safe way to choose a design.
4. Defer purchases and inventory writes to trusted backend work. **Why:**
   client-owned paid entitlements are insecure.

**Acceptance:** free designs are selectable; level-earned designs stay locked
until eligible; duplicates retain unique identity; unknown or locked saved
designs fall back safely; and `gameLogic.js` ignores cosmetics.

## 9. Progression and Leaderboards

**Baseline:** profiles contain games played and wins, but no XP, level, or
leaderboard data.

1. Add a deterministic XP/level presentation model with tests. **Why:** users
need consistent progress across portal and standalone storage.
2. Apply progression once per match with an idempotency key where available.
**Why:** reconnects/remounts must not duplicate rewards.
3. Add compact level feedback in profile and victory UI. **Why:** it belongs at
persistent identity and match end.
4. Defer global/regional/weekly ranking to server-authoritative results and a
materialized backend. **Why:** client-authored rankings are forgeable.

**Acceptance:** local/portal progression is deterministic and responsive;
leaderboards remain disabled until authoritative results and privacy controls
exist.

## Verification Order

For each section: focused unit tests, browser tests at `http://localhost:5173`,
then CrazyGames screenshot capture. After all features pass, inspect portal
screenshots at every required viewport and fix clipping, overlap, or unreadable
text.
