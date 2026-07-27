# Monetization Implementation ExecPlan

**Status:** In progress; client Temple Coin MVP implemented, trusted backend milestones pending
**Created:** July 2026
**Product direction:** [monetization-strategy.md](./monetization-strategy.md)
**Game-rule authority:** [LogicAndRules.md](../LogicAndRules.md)

This is a living execution plan for implementing Dyut's earned economy,
cosmetics, ads, and optional purchases on CrazyGames and the standalone web
build. Update its progress, decisions, and discovered impacts while work is in
flight.

The plan deliberately puts server authority before valuable balances. The
current browser client calculates match outcomes and initiates stat writes. That
is not sufficient for currency, inventory, public entry pools, or purchase
fulfillment.

## Outcome

When all approved milestones are complete:

- Normal public Online Match requires 500 earned Temple Coins per player.
- Offline play, Play with Friends, and CrazyGames Instant Multiplayer have a
  permanent free path.
- A trusted backend owns balances, inventory, match settlement, and purchase
  fulfillment.
- Players can earn non-transferable Temple Coins and spend them only on
  approved soft-currency sinks.
- Players can equip duplicate cosmetic designs while seat colors and
  accessibility markers keep pieces distinguishable.
- CrazyGames and standalone builds load only their permitted platform SDKs.
- Every monetization state has automated unit, emulator/integration, and browser
  coverage appropriate to its trust boundary.

Real-money wagering, cash-out, trading, loot boxes, gameplay power, and paid
currency entry are explicitly outside this plan.

## Non-Negotiable Product Invariants

1. Normal public Online Match requires exactly the active server-configured
   entry value, initially 500 Temple Coins.
2. `Play with Friends` and offline play never charge an entry fee.
3. CrazyGames Instant Multiplayer never requires a positive balance.
4. Purchased currency never enters match settlement.
5. The backend, not `GameContext.jsx` or `VictoryScreen.jsx`, commits rewards.
6. Retrying a request cannot duplicate a deduction, refund, reward, or purchase.
7. A cosmetic never changes movement, collision, dice, pathing, or visibility of
   required game information.
8. The CrazyGames Basic Launch build does not request ads or expose non-working
   IAP controls.

Treat violation of any invariant as a release blocker.

## Decisions Required Before Implementation

Record each answer in this section before its dependent milestone starts.

- [x] Use Temple Coins for normal public Online Match entry.
- [x] Initial entry is 500 coins per player.
- [x] Daily-login reward is 500 coins.
- [x] Completed public matches remove a 10% fee and award the remaining 90% pool
  to the winner; losers receive no pool payout.
- [ ] Choose the rewarded-ad coin amount and daily ad cap.
- [x] Daily reward resets at a fixed UTC calendar-day boundary.
- [ ] Define 2v2 team prize distribution before enabling pooled team matches.
- [ ] Validate the approved 500/500/10% values with a source/sink simulation
  before production rollout.
- [ ] Decide whether the first paid release uses direct cosmetic prices or
  Gems. Recommendation: direct prices until the catalog is large enough to
  justify premium currency.
- [ ] Confirm Firebase project environments for local emulator, staging, and
  production.
- [ ] Confirm CrazyGames Full Launch/ad status and whether the game has received
  an IAP invitation before exposing those controls.
- [ ] Obtain legal/tax/privacy review for the intended launch countries before
  paid products or outcome-dependent entry/rewards are enabled.

## Progress

- [x] Monetization and platform strategy documented.
- [x] Current client, Firebase, piece-rendering, and Playwright surfaces audited.
- [x] Client economy boundary, integer math, automatic 500-coin daily reward,
  500-coin public entry, 10% fee, 90% winner payout, free-mode exemptions, and
  local Chrome fixtures implemented.
- [x] Free piece-design MVP: stable catalog IDs, safe default fallback,
  lobby selection, match-snapshot propagation, duplicate designs, mandatory
  unique seat-color rendering, localization, and local Chrome coverage.
- [ ] Replace client persistence/settlement adapters with trusted Functions
  before coins can be purchased or treated as tamper-resistant.
- [ ] Milestone 0 — feature boundaries and deterministic test seams.
- [ ] Milestone 1 — trusted identity and server-authoritative online results.
- [ ] Milestone 2 — append-only wallet and earned economy.
- [ ] Milestone 3 — cosmetic catalog, inventory, and piece identity separation.
- [ ] Milestone 4 — standalone purchases.
- [ ] Milestone 5 — platform-specific advertising.
- [ ] Milestone 6 — public Online Match entry pool.
- [ ] Milestone 7 — CrazyGames IAP, only if invited.
- [ ] Final security, economy, accessibility, and portal release gates.

## Architecture and Trust Boundaries

Use three layers:

```text
React UI
  └── typed client service adapters
        ├── Firebase callable functions / authenticated HTTPS
        ├── CrazyGames SDK adapter
        └── standalone payment/ad adapters

Trusted backend
  ├── identity verification
  ├── authoritative match actions and completion
  ├── wallet ledger and balance projection
  ├── inventory entitlements
  ├── purchase/ad fulfillment
  └── audit and reconciliation

Storage
  ├── RTDB: live authoritative game state
  └── Firestore: profiles, ledger, balances, catalog, inventory, settlements
```

Client feature flags may hide presentation, but they are not authorization.
Every trusted endpoint must enforce platform, identity, product, balance, and
idempotency rules independently.

Keep local single-player gameplay client-side. Only online result paths need
trusted settlement.

## Planned Data Contracts

Use integer minor units only; never floating-point balances.

### Wallet

```js
wallets/{uid} = {
  templeCoins: 0,
  gems: 0,                 // omit until premium currency is approved
  version: 1,
  updatedAt
}

walletLedger/{entryId} = {
  uid,
  currency: 'templeCoins' | 'gems',
  delta,
  reason: 'starter' | 'match' | 'quest' | 'ad' | 'purchase' |
          'cosmetic' | 'refund' | 'support',
  referenceId,
  idempotencyKey,
  economyVersion,
  createdAt,
  actor: 'system' | 'webhook' | 'support'
}
```

Clients may read their projection and ledger history but may never create,
update, or delete ledger entries.

### Cosmetics

```js
products/{productId} = {
  type: 'pieceSkin' | 'boardTheme' | 'diceSkin' | 'emote' |
        'profileFrame' | 'victoryEffect',
  assetKey,
  price,
  currency,
  platforms,
  active,
  catalogVersion
}

inventories/{uid}/items/{productId} = {
  source,
  entitlementId,
  acquiredAt
}

profiles/{uid}.equipped = {
  pieceSkinId,
  boardThemeId,
  diceSkinId,
  emotePackId,
  profileFrameId,
  victoryEffectId
}
```

`products` are server/admin-controlled. Equipped IDs must reference owned or
free-default products.

### Match settlement

```js
matchSettlements/{matchId} = {
  mode,
  rulesVersion,
  economyVersion,
  participantUids,
  authoritativeResult,
  entryPerPlayer,
  grossPool,
  matchFeeBps,
  matchFee,
  winnerPrize,
  startedAt,
  completedAt,
  status: 'pending' | 'settled' | 'refunded' | 'invalid',
  settlementEntryIds
}
```

Use `match:{matchId}:settlement:{uid}` as the result idempotency key and a
separate `match:{matchId}:entry:{uid}` key for each public-match reservation.

## Milestone 0 — Boundaries and Test Seams

### Implementation

1. Add a platform capability object derived from environment and SDK state:
   `isCrazyGames`, `isBasicLaunch`, `supportsAds`, `supportsIap`, and
   `applicationType`.
   Why: scattered environment checks currently make it easy for unsupported UI
   or SDK calls to leak into a build.

2. Add service interfaces with no-op/default implementations:
   `economyClient`, `catalogClient`, `entitlementClient`, `adClient`, and
   `purchaseClient`.
   Why: React components need testable contracts and must not call Firebase,
   Stripe, or CrazyGames directly.

3. Add deterministic QA fixtures that are available only in development/test
   builds.
   Why: Playwright needs winner, loser, balances of 0/499/500, daily eligible/
   granted, duplicate-skin, ad-error, and purchase-pending states without
   contacting production services.

4. Add server-controlled remote feature flags for `earnedEconomy`,
   `cosmetics`, `rewardedAds`, `standalonePurchases`, `publicOnlineEntry`, and
   `crazyGamesIap`.
   Why: each feature needs an independent kill switch and staged rollout.

### Code impact

| Path | Change |
| --- | --- |
| `platformCapabilities.js` (new) | Normalize build, SDK, and application capabilities |
| `services/economyClient.js` (new) | Read-only balance/history and trusted action calls |
| `services/catalogClient.js` (new) | Catalog and equip APIs |
| `services/adClient.js` (new) | Platform-neutral rewarded/midgame contract |
| `services/purchaseClient.js` (new) | Platform-neutral checkout contract |
| `qaFixtures.js` (new) | Development-only deterministic states |
| `App.jsx` | Construct adapters/providers and replace ad environment branching |
| `UnifiedLobby.jsx` | Consume capabilities rather than raw environment values |
| `VictoryScreen.jsx` | Consume ad capability rather than SDK directly |
| `.env`, `.env.crazygames` | Presentation defaults only; no secrets |

### Acceptance

- Existing behavior is unchanged with every new feature flag off.
- `npm test`, current Playwright tests, and both builds pass.
- Searching the CrazyGames bundle finds no Stripe or standalone ad SDK.
- Production builds cannot activate QA fixtures through a URL parameter.

## Milestone 1 — Trusted Identity and Authoritative Online Results

This milestone is a hard dependency for rewards, paid entitlements, public entry
entry, and leaderboards.

### Implementation

1. Add Firebase Cloud Functions and local Emulator Suite configuration.
2. Verify CrazyGames user tokens in a callable/HTTPS function and issue Firebase
   custom tokens. Do not persist the CrazyGames token.
3. Extract pure game-state transitions and validation from React-specific code
   into a shared module used by the browser and Functions.
4. Move online dice generation and move validation behind authenticated,
   transactional server actions.
5. Record immutable action IDs and reject duplicate, out-of-turn, illegal, or
   stale actions.
6. Complete a match only from authoritative state using the winning conditions
   in `LogicAndRules.md`: exact finish and all required pieces/team members
   finished. Do not infer standard Ludo rules.
7. Keep local and AI modes on the existing reducer path.
8. Initially run the trusted online path behind a staging flag and compare
   server/client state before making it authoritative.

### Code impact

| Path | Change |
| --- | --- |
| `functions/` (new) | Cloud Functions package, auth, game commands, tests |
| `firebase.json` (new) | Emulator and deploy targets |
| `firestore.rules` (new) | Deny trusted client writes; owner-scoped reads |
| `database.rules.json` (new) | Restrict RTDB game mutations |
| `shared/game/` (new) | Pure rule/state modules reused by client and backend |
| `gameLogic.js`, `boardMapping.js` | Re-export or move pure helpers without behavior changes |
| `GameContext.jsx` | Send online intents and consume authoritative snapshots |
| `firebaseSetup.js` | Trusted-auth bootstrap; remove future trusted write paths |
| `crazyGamesData.js` | Retain non-authoritative preferences/cache only |

### Testing

- Reuse rule fixtures against both client and server modules.
- Emulator tests: invalid auth, wrong turn, forged dice, illegal move, stale
  version, duplicate action ID, reconnect retry, valid finish, team finish,
  Quick Game finish, and post-finish action rejection.
- Two-browser Playwright staging test confirms clients converge after every
  action and reconnect.
- Existing rule regression tests remain unchanged and green.

### Acceptance

- A client cannot choose dice, write a move directly, or mark a game finished.
- Duplicate requests return the original result without another transition.
- Local/offline behavior remains unchanged.
- The server and current rule suite produce identical terminal outcomes.

## Milestone 2 — Wallet and Earned Economy

### Implementation

1. Add wallet/ledger repositories whose only mutation primitive is an atomic
   ledger transaction with an idempotency key.
2. Lazily create existing-user wallets at zero or grant one versioned starter
   transaction. Never rewrite profile history.
3. Add server-controlled economy configuration by mode and version.
4. At the first authenticated session in each eligible period, automatically
   grant exactly 500 daily-login coins through an idempotent server transaction
   and show a non-blocking confirmation.
5. Add server-configured rewarded-ad grants and daily caps only when the
   producing platform supports ads and the completion signal is accepted.
6. Keep public match entry and pool settlement disabled until Milestone 6.
7. Return authoritative daily/ad grant summaries to the client.
8. Add a balance indicator, ledger/history screen, daily grant state/timer, and reward
   summary. The UI
   displays committed records; it does not optimistically alter balances.
9. Add support adjustment and reconciliation scripts with auditable reasons.

### Code impact

| Path | Change |
| --- | --- |
| `functions/src/economy/` (new) | Ledger transactions, daily/ad grants, reconciliation |
| `firestore.indexes.json` (new) | Owner ledger/history queries |
| `services/economyClient.js` | Subscribe to projection and request trusted actions |
| `EconomyProvider.jsx` (new) | UI loading/error/stale state |
| `WalletSummary.jsx` (new) | Balance, daily grant timer, and available ad earn action |
| `WalletHistory.jsx` (new) | Accessible transaction history |
| `VictoryScreen.jsx` | Server-confirmed win/loss/draw reward summary |
| `MainMenu.jsx` or `UnifiedLobby.jsx` | Balance entry point outside gameplay |
| `en.json`, `hi.json`, `mr.json` | Currency, pending, error, refund, and reward strings |

### Testing

- Unit tests: integer math, economy-version lookup, daily eligibility, reset
  boundary, ad caps, and display formatting.
- Emulator tests: concurrent grants, insufficient funds, duplicate settlement,
  duplicate daily login, ad callback replay, transaction retry, partial failure,
  missing wallet migration, and denied direct writes.
- Property/invariant test: projected balance equals the sum of ledger deltas and
  never drops below zero.
- Playwright: daily eligible/granted/countdown, ad success/error/cap, balances
  0/499/500, service error, refresh, and duplicate callback display behavior.

### Acceptance

- Replaying match completion produces no extra balance.
- The Victory screen never promises an uncommitted reward.
- A new/existing user can load with missing economy documents.
- Disabling `earnedEconomy` stops new grants while preserving history and access
  to free multiplayer.

## Milestone 3 — Cosmetics and Piece Identity

The free piece-design and identity-separation subset is implemented. The
server-owned catalog, account inventory, entitlement/equip APIs, and
Store/Collection UI below remain planned.

### Implementation

1. Add free defaults and a versioned server-owned product catalog.
2. Add inventory entitlement and equip endpoints.
3. Split the current player `color` concern into:
   - `seatColor`: unique gameplay identity selected/assigned by the lobby.
   - `seatPattern`: stable accessibility marker.
   - `pieceSkinId`: equipped visual design; duplicates allowed.
4. Render every skin as a cosmetic material/silhouette layer plus a mandatory
   seat-color ring/base/center and pattern/icon.
5. Keep logical player state and persisted match snapshots backward compatible:
   missing cosmetic fields resolve to defaults.
6. Add Store/Collection UI outside active gameplay, including preview, owned,
   equipped, unavailable-platform, and error states.
7. Validate every board theme at supported viewports. Theme assets must not hide
   paths, safe zones, legal-move highlights, piece counts, or controls.

### Code impact

| Path | Change |
| --- | --- |
| `cosmetics.js` (new) | Safe defaults and render-token mapping |
| `services/catalogClient.js` | Catalog, purchase-with-coins, and equip calls |
| `CosmeticsProvider.jsx` (new) | Catalog/inventory/equipment state |
| `StoreScreen.jsx` (new) | Browse and preview products |
| `CollectionScreen.jsx` (new) | Equip owned cosmetics |
| `Board.jsx` | Accept skin plus mandatory seat identity layers |
| `UnifiedLobby.jsx` | Continue enforcing unique seat colors; show equipped preview |
| `GameContext.jsx` | Carry cosmetic snapshot without using it in rule calculations |
| `index.css`, `tailwind.config.js` | Cosmetic tokens and accessibility patterns |
| `public/cosmetics/` (new) | Optimized, catalog-keyed assets |
| locale files | Store, ownership, equip, and accessibility text |

### Testing

- Unit tests: default fallback, unknown/inactive product, ownership, equip
  validation, and immutable gameplay color mapping.
- Component tests: loading/empty/error catalog, purchase confirmation, equipped
  state, keyboard navigation, and translated labels.
- Board tests: same skin on all seats still renders four unique seat identities.
- Playwright visual tests at 1280x720 and 800x450:
  duplicate skins, every initial skin, long product/player names, selected piece,
  safe zones, move highlights, and high-contrast mode.

### Acceptance

- Two or four players can equip the same skin without identity ambiguity.
- Removing/renaming a catalog product falls back safely.
- Cosmetic fields never enter `gameLogic.js` decisions.
- Store and collection screens have no horizontal or vertical viewport overflow.

## Milestone 4 — Standalone-Web Purchases

Do not start until Milestones 1–3 and legal/tax/refund decisions are complete.

### Implementation

1. Create Stripe Checkout Sessions on the backend from server-owned product
   IDs and prices.
2. Verify Stripe webhook signatures and fulfill an entitlement idempotently.
3. Treat browser checkout return as `pending`; poll/read the backend entitlement
   rather than trusting URL parameters.
4. Add purchase status, receipt/reference, retry, refund-support, and restore
   messaging.
5. Add tax configuration and required consent/terms links.
6. Ensure the standalone payment adapter is tree-shaken/excluded from the
   CrazyGames build.

### Code impact

| Path | Change |
| --- | --- |
| `functions/src/purchases/stripe.js` (new) | Checkout creation and webhook verification |
| `services/purchaseClient.js` | Standalone checkout and entitlement status |
| `StoreScreen.jsx` | Direct-price purchase controls and pending state |
| `PurchaseStatus.jsx` (new) | Success, pending, failed, cancelled, refunded states |
| `App.jsx` | Handle safe checkout return routing |
| deployment secrets/config | Stripe keys and webhook secret; never `VITE_*` |

### Testing

- Backend tests use Stripe fixtures/test mode: valid signature, invalid
  signature, unknown product/price, duplicate webhook, out-of-order events,
  refund/reversal, and failed fulfillment retry.
- Playwright routes the checkout boundary or uses a local fake provider; it must
  never create a real charge.
- Playwright verifies cancel, pending, delayed webhook, success after refresh,
  duplicate return, and unsupported-platform hiding.

### Acceptance

- A forged success URL grants nothing.
- Duplicate/out-of-order webhooks create one correct entitlement.
- The CrazyGames output contains no Stripe client or checkout controls.

## Milestone 5 — Ads

### Implementation

1. Keep all ad capabilities false for CrazyGames Basic Launch.
2. Add CrazyGames rewarded/midgame handling only after Full Launch approval.
3. Add an independent standalone-web adapter only if a provider and consent flow
   are approved.
4. Place rewarded ads behind explicit player action with the exact fixed reward
   shown in advance and a free recovery path nearby.
5. Place midgame ads only after completed matches and subject to server/SDK
   pacing.
6. Handle started, finished, error, no-fill, blocked, unsupported, and cancelled
   outcomes. Always restore audio/game state.
7. Grant a reward only through a trusted, capped, idempotent backend endpoint.
   If the selected web ad provider cannot supply adequate server verification,
   use strict caps and treat rewards as low-value/promotional.

### Code impact

| Path | Change |
| --- | --- |
| `services/adClient.js` | CrazyGames, standalone, and no-op adapters |
| `RewardedAdButton.jsx` (new) | Consent, reward disclosure, loading/error state |
| `App.jsx` | Platform adapter initialization and lifecycle |
| `VictoryScreen.jsx` | Natural-break midgame trigger; no reward coupling |
| `WalletSummary.jsx` | Optional earn action outside gameplay |
| `audio.js` | Idempotent mute/pause/resume integration |
| `functions/src/economy/adRewards.js` (new) | Caps and idempotent grants |
| consent/privacy UI | Standalone consent where required |

### Testing

- Unit tests for every ad callback order and double-callback.
- Component tests for disclosure, disabled, loading, error, no-fill, and capped
  states.
- Playwright installs a fake CrazyGames SDK before page load and verifies:
  Basic Launch makes zero ad requests; Full Launch calls at a natural break;
  cancel/error/no-fill restores controls and sound; success displays only a
  server-confirmed reward; repeated clicks do not chain ads.
- Manual CrazyGames Preview QA remains mandatory because local demo overlays
  cannot prove production ad fill or portal behavior.

### Acceptance

- Ad failure never blocks starting or replaying a match.
- No ad starts during a turn, invite join, reconnect, or seat claim.
- Basic Launch and unsupported app types have no non-functional reward button.

## Milestone 6 — Public Online Match Entry Pool

This is last because it has the highest economy, abuse, fairness, and legal
impact.

### Implementation

1. Apply the entry only to the explicit normal public `Online Match` queue.
   Offline, Play with Friends, and CrazyGames Instant Multiplayer stay free.
2. Publish the 500-coin entry, 10% match fee, winner prize, zero loser payout,
   disconnect behavior, and refund rules before confirmation.
3. Atomically reserve/deduct 500 coins from every participant at authoritative
   match start, not lobby seat claim.
4. Refund if the match never starts or a verified platform/server incident
   invalidates it.
5. Compute the settlement from the committed participant list:

   ```text
   grossPool = 500 × participantCount
   matchFee = grossPool × 10%
   winnerPrize = grossPool - matchFee
   loserPrize = 0
   ```

   For 1v1 this records a 1,000-coin gross pool, a 100-coin fee, and a
   900-coin winner prize. For 4-player FFA it records 2,000, 200, and 1,800.
   Keep 2v2 disabled until team prize distribution is approved.
6. Add minimum-play, repeat-opponent, daily-cap, and suspicious-cluster controls.
7. Below 500 coins, disable only public Online Match and show the next daily
   grant time, available rewarded ad, Play with Friends, offline, and portal
   Instant alternatives.
8. Start with a small server-configured experiment and stop automatically if
   completion, fairness, or zero-balance health thresholds regress.

### Code impact

| Path | Change |
| --- | --- |
| `functions/src/matchmaking/` (new) | Queue eligibility and authoritative start |
| `functions/src/economy/publicMatchPool.js` (new) | Entry reservation, fee, refund, and pool settlement |
| `matchmaking.js` | Client request/response only; no balance decisions |
| `UnifiedLobby.jsx` | Public entry disclosure, balance gate, and free alternatives |
| `VictoryScreen.jsx` | Entry/reward/refund settlement breakdown |
| remote economy config | Versioned values and experiment allocation |

### Testing

- Emulator concurrency tests: two starts, insufficient balance race, start then
  failure, disconnect, reconnect, forfeit, draw, server invalidation, and retry.
- Abuse tests: repeated opponents, instant surrender, duplicate accounts where
  signals are available, and daily limits.
- Playwright: public match at 499/500 coins; free offline/friends/Instant access;
  confirmation disclosure; two-player 1,000/100/900 settlement; loser zero
  payout; draw refund; reconnect; and feature-kill rollback.

### Acceptance

- No client can deduct, refund, choose a reward, or select an economy version.
- A failed reservation cannot start a public Online Match.
- A successful reservation eventually has exactly one settlement or refund.
- Platform and queue free-path invariants remain green.

## Milestone 7 — CrazyGames IAP

Skip this milestone unless CrazyGames explicitly invites the game to IAP.

### Implementation

1. Read user and application capability from the CrazyGames SDK.
2. Hide IAP controls when signed out or when the application type does not
   support purchases.
3. Request products/purchases through CrazyGames APIs only.
4. Verify fulfillment through the approved CrazyGames inventory/webhook path.
5. Reconcile existing purchases at login and after reconnect.
6. Keep CrazyGames product IDs mapped to the same internal entitlement catalog
   as standalone products.

### Testing

- Adapter contract tests for signed-out, unsupported app, SDK error, purchase
  cancel, delayed inventory, restore, and duplicate fulfillment.
- Playwright uses a fake SDK only for UI/flow behavior.
- Final purchase verification is performed in CrazyGames Preview/test mode.

### Acceptance

- No Stripe code or link appears in the CrazyGames build.
- Unsupported CrazyGames application types show no purchase button.
- Client callbacks cannot mint an entitlement.

## Full Code-Impact Matrix

| Existing area | Expected impact | Risk |
| --- | --- | --- |
| `App.jsx` | Providers, capabilities, QA fixtures, platform lifecycle | Medium |
| `GameContext.jsx` | Online intent path and authoritative completion | Critical |
| `gameLogic.js` | Shared pure exports; no rule changes | Critical |
| `boardMapping.js` | Shared pure exports; no path changes | Critical |
| `firebaseSetup.js` | Trusted auth bootstrap and read subscriptions | High |
| `crazyGamesData.js` | Preferences/cache only; never wallet authority | Medium |
| `matchmaking.js` | Server request adapter | High |
| `UnifiedLobby.jsx` | Store/wallet entry points and public entry UI | High |
| `Board.jsx` | Skin layer plus persistent seat identity | High visual risk |
| `VictoryScreen.jsx` | Confirmed settlement and ad lifecycle | Medium |
| `audio.js` | Ad lifecycle restoration | Medium |
| locale JSON | All new visible states | Low |
| Tailwind/CSS | Cosmetic tokens and responsive layouts | Medium |
| existing Vitest files | Regression and component expansion | High coverage |
| `e2e/dyut-ui.spec.js` | Preserve core smoke suite | Low |
| `playwright.config.js` | Additional projects/fixtures/reporting | Medium |

No gameplay-rule modification is planned. If extraction reveals ambiguous
behavior, stop and resolve it against `LogicAndRules.md` before changing code.

## Test Architecture

### Unit and component tests — Vitest

Continue using jsdom for React tests and add a Node-environment Functions
configuration. Test:

- pure economy/config calculations
- platform capability mapping
- adapter no-op/error behavior
- cosmetic fallback and seat identity
- UI loading, pending, error, translated, and disabled states
- unchanged game-rule behavior

Use fake timers only where unavoidable. Prefer explicit state transitions and
stable fixtures.

### Backend integration — Firebase Emulator Suite

These tests prove trust-boundary behavior that Playwright cannot:

- Firestore/RTDB security rules
- callable authentication and authorization
- transactions under concurrency
- action and ledger idempotency
- webhook replay/order behavior
- match completion and wallet reconciliation

Run each test with isolated emulator data. Do not point automation at staging or
production Firebase.

### Browser tests — Playwright

Keep `e2e/dyut-ui.spec.js` as a fast, platform-neutral smoke suite. Add:

| Proposed file | Coverage |
| --- | --- |
| `e2e/economy-ui.spec.js` | balance, history, settlement, zero/error/pending states |
| `e2e/cosmetics.spec.js` | catalog, equip, duplicate skins, responsive board |
| `e2e/free-paths.spec.js` | Offline, friends, and Instant free-access invariants |
| `e2e/ads.spec.js` | Basic no-op and Full Launch callback/lifecycle behavior |
| `e2e/purchases.spec.js` | standalone pending/cancel/success/restore; platform hiding |
| `e2e/public-online-entry.spec.js` | 500 entry, 10% fee, pool payout, refund, recovery |
| `e2e/multiplayer-authority.spec.js` | two-browser synchronization and reconnect |

Add reusable fixtures:

- `e2e/fixtures/platform.js`: standalone, CrazyGames Basic, CrazyGames Full,
  unsupported app types.
- `e2e/fixtures/backend.js`: deterministic QA API or emulator seed helpers.
- `e2e/fixtures/users.js`: authenticated user/balance/inventory states.
- `e2e/helpers/layout.js`: current overflow and truncation assertions.

Do not expose a production QA route. Either compile fixtures only in test mode
or seed the local emulator before navigation.

### Playwright configuration updates

1. Retain one worker for stateful multiplayer/economy tests unless each test has
   isolated emulator namespaces.
2. Add projects or scripts for:
   - standalone local
   - CrazyGames Basic capability stub
   - CrazyGames Full capability stub
   - compact landscape/mobile viewport
3. Keep screenshots and traces on failure. Add a deterministic visual snapshot
   subset only for piece identity and board readability.
4. Add tags:
   - `@smoke` for current five tests plus free-path checks
   - `@economy` for wallet/settlement
   - `@portal` for CrazyGames capability behavior
   - `@payments` for local fake-provider flows
5. Never add blanket retries to hide flakes. Fix deterministic state and wait
   for user-visible/backend-confirmed conditions instead of arbitrary delays.

Suggested scripts:

```json
{
  "test:ui:smoke": "playwright test --grep @smoke",
  "test:ui:economy": "playwright test --grep @economy",
  "test:ui:portal": "playwright test --grep @portal",
  "test:emulators": "firebase emulators:exec --only auth,firestore,database,functions \"npm run test:functions\"",
  "test:release": "npm test && npm run test:emulators && npm run test:ui && npm run build && npm run build:crazygames"
}
```

Final command details may change with the Functions package manager, but the
release gate must retain all five layers.

## Required Playwright Scenarios

### Always run

- Current menu, local match, Play with Friends, victory, and long-name tests.
- No viewport overflow at 1280x720 and 800x450.
- Offline play, Play with Friends, and CrazyGames Instant Multiplayer are
  available with zero balance.
- Public Online Match is disabled at 499 coins and enabled at 500.
- Feature flags off reproduce the pre-economy UI.

### Economy

- First wallet load, missing wallet migration, and refresh.
- First eligible login grants 500 once per configured period; refresh/replay
  grants nothing.
- Rewarded-ad success grants the configured amount; error/cancel/replay grants
  nothing.
- Winner/loser/draw/forfeit/refund summaries use backend-confirmed values.
- Pending settlement does not change the visible balance.
- Repeated callbacks/navigation do not show duplicate ledger rows.
- Service failure leaves free gameplay available.

### Cosmetics

- Two and four seats using one skin remain distinguishable.
- Long skin/player names truncate and retain accessible full names.
- Unknown/removed skin falls back to default.
- Equip persists after refresh and reconnect.
- Safe zones, legal moves, and selected pieces remain visually identifiable.

### Platform separation

- CrazyGames Basic: no ad request, rewarded button, IAP button, Stripe link, or
  blocked free path.
- CrazyGames Full: fake SDK callbacks exercise success/cancel/error/no-fill.
- CrazyGames unsupported app: IAP hidden.
- Standalone: no CrazyGames dependency required; only standalone controls show.

### Purchases

- Checkout cancel returns safely.
- Browser success return remains pending until backend entitlement appears.
- Delayed/duplicate webhook results in one owned item.
- Refresh/restore resolves a previously completed purchase.
- Purchase/provider failure does not deduct Temple Coins or block gameplay.

### Public Online Match pool

- The UI discloses the 500 entry and 10% fee before confirmation.
- A completed 1v1 shows a 1,000 pool, 100 fee, 900 winner payout, and zero loser
  payout.
- Insufficient balance points to daily/ad earning and free modes without a dead
  end.
- Concurrent/retried start is represented once.
- Disconnect/reconnect and server invalidation show the correct settlement.
- Kill switch removes paid public entry while preserving balances and free
  offline/friends/Instant modes.

## Release Gates

Every implementation pull request:

```powershell
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
npm.cmd run build:crazygames
git diff --check
```

Backend milestones additionally require emulator tests. Platform milestones
require bundle inspection and manual CrazyGames Preview QA.

Before production enablement:

- [ ] Security rules deny direct wallet, ledger, entitlement, result, and catalog
  mutation.
- [ ] Emulator concurrency and idempotency suites pass.
- [ ] Both builds contain only permitted platform SDKs.
- [ ] Free offline/friends/Instant Playwright tests pass at zero balance.
- [ ] Public Online Match 500-entry and 10%-fee settlement tests pass.
- [ ] Duplicate-skin visual/accessibility tests pass.
- [ ] Economy simulation and staged telemetry thresholds are approved.
- [ ] Privacy, consent, tax, refund, terms, and support flows are ready.
- [ ] Kill switches and reconciliation tooling are exercised in staging.
- [ ] CrazyGames Preview QA passes for portal-only behavior.

## Suggested Pull-Request Sequence

Keep changes reviewable and independently reversible:

1. Platform capabilities, adapters, and QA fixture boundary.
2. Shared rule extraction with zero behavior changes.
3. Firebase Functions/emulators and authenticated server action skeleton.
4. Server-authoritative dice/moves/completion.
5. Wallet ledger and read-only UI.
6. Match grants with no entry fees.
7. Cosmetic catalog/inventory and seat identity rendering.
8. Standalone checkout/webhook, if approved.
9. Ads, after platform approval.
10. Public Online Match entry pool, after legal/economy approval.
11. CrazyGames IAP, only if invited.

Do not combine server authority, wallet mutations, cosmetic rendering, and
payments in one pull request.

## Deployment, Rollback, and Recovery

- Deploy security rules and backend support before enabling client UI.
- Add schemas lazily and backward-compatibly; do not bulk-overwrite profiles.
- Version rules, catalog, and economy values.
- Roll out to internal/staging users, then a small percentage, then by platform.
- On an incident, disable grants/spends/public entry/purchases independently while
  leaving free gameplay available.
- Never delete or rewrite ledger history during rollback.
- Reconcile projections from the ledger and repair through compensating entries,
  not edits to old records.
- Preserve old cosmetic defaults so clients can render unknown/newer snapshots.

## Open Risks

- Full server authority is a substantial prerequisite, not a small economy task.
- Moving rule modules can cause subtle gameplay regressions; shared fixtures and
  current tests must prove behavior equivalence.
- Rewarded web ads may not offer strong server-side reward verification.
- CrazyGames ad/IAP availability can change by launch status and application
  type; capabilities must be runtime-aware.
- A 500-coin public entry can still feel punitive even without purchases.
  Telemetry must prove it improves engagement before broad rollout.
- New skins can reduce board readability at compact portal dimensions.
- Payment refunds, chargebacks, and catalog removal require durable entitlement
  policies before launch.

## Documentation Updates During Implementation

Update these documents whenever their corresponding behavior changes:

- `README.md`: setup, scripts, emulator requirements, and feature status.
- `CrazyGamesQA.md`: ads, IAP capability, free Instant Multiplayer, and Preview
  checks.
- `LogicAndRules.md`: only if the user explicitly approves a gameplay-rule
  change.
- `future-plans/monetization-strategy.md`: product decisions or platform-policy
  changes.
- This ExecPlan: progress, decisions, discovered impacts, test results, and
  deviations from the planned sequence.
