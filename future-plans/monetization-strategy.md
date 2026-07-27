# Dyut Monetization and Economy Strategy

**Status:** Temple Coin and free piece-design client MVPs implemented; trusted backend, ads, purchases, and full cosmetic inventory/store remain planned
**Reviewed:** July 2026
**Applies to:** CrazyGames and the standalone web build

Implementation sequencing, code impact, and test requirements are maintained in
[monetization-execution-plan.md](./monetization-execution-plan.md).

This document supersedes the monetization assumptions in Phase 26 of
`futureEnhancements.md` and the older `26-1`, `26-2`, and `26-3` planning notes.
Those files remain useful as historical context, but their client-side wager
implementation should not be used. The July 2026 product decision does use a
server-authoritative pooled entry model with the values documented below.

## Executive Decision

Dyut should monetize through an earned-coin public-match economy, optional
cosmetics, and carefully placed opt-in ads, not through paid gameplay power or
cash-like currency.

The recommended economy has three strict rules:

1. A normal public Online Match costs 500 earned Temple Coins per player.
2. The entry pool is reduced by a 10% match fee and the remaining 90% is awarded
   to the winner after server-authoritative settlement.
3. Offline play, Play with Friends, and CrazyGames Instant Multiplayer are free.
4. Players receive 500 Temple Coins automatically on the first eligible daily
   login and may earn additional coins from opt-in rewarded ads where the
   platform permits them.
5. Purchased premium currency may buy cosmetics only. It must never be used as
   an entry fee, prize, tradeable asset, or cash-equivalent reward.

This separation makes the public queue meaningful while leaving social, portal
Instant Multiplayer, and offline modes available at zero balance. The pool must
not launch until server authority, fraud controls, and jurisdiction review are
complete.

## What the Current Code Supports

The current game has useful foundations, but not a secure economy:

- Firebase profiles store identity, games played, and wins. They do not have a
  trusted wallet, cosmetic inventory, purchase ledger, or account-level equipped
  cosmetic.
- Match completion and stat updates are initiated by clients. RTDB synchronizes
  games, but there is no server-authoritative result validator.
- Match snapshots carry `pieceSkinId` separately from the unique seat `color`.
  The lobby currently offers four free designs and permits duplicates while the
  colored token body remains the player-identity marker.
- The CrazyGames build has `VITE_CG_ENABLE_ADS=false`, which is appropriate
  during Basic Launch.
- A small code-owned free design catalog exists; a server-owned product catalog,
  entitlements, purchases, and collection/store UI do not.

Consequently, balances, entry fees, rewards, inventory, and purchases must not
be added as trusted client writes.

## Platform Strategy

| Capability | CrazyGames Basic Launch (current) | CrazyGames Full Launch | Standalone web |
| --- | --- | --- | --- |
| Public Online Match | 500 earned coins | 500 earned coins | 500 earned coins |
| Offline / Play with Friends | Free | Free | Free |
| Display/midgame ads | Disabled | CrazyGames SDK only | Optional web ad provider |
| Rewarded ads | Disabled | CrazyGames SDK, explicit opt-in | Optional, explicit opt-in |
| Real-money cosmetics | No general launch path | CrazyGames IAP only if invited | Stripe Checkout |
| Purchase fulfillment | Not applicable | Webhook/inventory verification | Stripe webhook |
| Instant Multiplayer | Always free/sponsored | Always free/sponsored | Not applicable |
| Paid SDKs loaded in build | None | Never load a competing ad/payment SDK | Never load CrazyGames SDK |

CrazyGames Basic Launch does not share ad revenue and requires ads to remain
disabled. At Full Launch, only the CrazyGames ad SDK may be used in that build.
CrazyGames IAP is invitation-only, requires a signed-in CrazyGames user, and
must be hidden when the current CrazyGames application type does not support
payments.

## Proposed Value Types

### Temple Coins — earned soft currency

Temple Coins are non-transferable, have no cash value, and cannot be purchased
in the first economy release.

Confirmed sources:

- daily-login grant: 500 coins automatically on the first authenticated session
  in each eligible calendar/cooldown period
- opt-in rewarded ads: amount and daily cap are server-configured

Possible later sources:

- onboarding
- daily/weekly quests
- progression milestones

Possible sinks:

- normal public Online Match entry: 500 coins
- selected earnable cosmetics
- profile and emote unlocks

Temple Coins must never be cashable, tradeable, gifted, or converted to premium
currency.

### Gems — purchased premium currency

Gems may be introduced only after verified server-side purchase fulfillment.
They buy deterministic cosmetics and convenience such as an ad-free supporter
upgrade. Gems cannot enter a match pool, affect dice or movement, or convert to
Temple Coins.

Directly priced cosmetic products are simpler and more transparent than Gems
for the first standalone-web purchase release. Gems should be introduced only
if a larger catalog makes them beneficial.

## Match Entry, Winning, and Losing

For a completed eligible public match:

```text
gross pool = 500 × number of participating players
match fee = gross pool × 10%
winner prize = gross pool - match fee
loser reward = 0
```

| Public mode | Players | Gross pool | Match fee | Winner prize |
| --- | ---: | ---: | ---: | ---: |
| 1v1 | 2 | 1,000 | 100 | 900 |
| 4-player FFA | 4 | 2,000 | 200 | 1,800 |

Public 2v2 pools only paid human entries and splits the post-fee prize equally
among winning human teammates. Four humans produce a 2,000-coin gross pool and
pay 900 coins to each of two winning humans. Two humans plus two bots produce a
1,000-coin gross pool and pay the sole winning human 900 coins. Bots never pay
an entry or receive a prize share.

The 500-coin entry, 500-coin daily-login grant, and 10% fee are initial
server-configured economy values. Version them so they can be tuned without
changing or reinterpreting completed settlements.

### Settlement rules

- Reserve or deduct each 500-coin entry at authoritative match start, not when a lobby seat is
  claimed.
- Refund automatically if the match never starts or a verified server/platform
  failure invalidates it.
- A normal disconnect or forfeit counts as a loss after a short reconnect
  window.
- Award a result only after a minimum amount of meaningful play, preventing
  instant surrender farming.
- A normal loss receives no pool payout.
- Draws refund all entries; no match fee is charged.
- Reduce or block rewards from repeated matches between the same accounts,
  devices, or suspicious network clusters.
- Use daily earning limits and diminishing returns before banning legitimate
  friends from playing repeatedly.
- Never rely on the Victory screen to credit a wallet; it only displays the
  server-confirmed settlement.

### Zero-balance behavior

- Normal public Online Match is unavailable below 500 coins.
- Offline play and Play with Friends remain free.
- CrazyGames Instant Multiplayer always has a free/sponsored queue.
- Show the next 500-coin daily grant time and an available rewarded-ad option
  beside the insufficient-balance message.
- During CrazyGames Basic Launch, hide the rewarded-ad control because ads are
  disabled; the daily grant and free modes remain usable.
- Do not sell a currency that can be lost through gameplay.

## Piece Designs and Player Colors

Cosmetic design must be independent from gameplay identity:

```text
player
├── seatColor       unique, match-owned identity
├── seatPattern     accessibility identity
└── pieceSkinId     account cosmetic; duplicates allowed
```

A piece skin controls material, silhouette, ornament, and animation. The
mandatory seat-color layer controls a prominent ring, base, center mark, or
outline. Two players may equip the same design and still remain distinguishable.
Each seat should also have a stable pattern or icon so the board is usable for
players with color-vision differences.

Recommended cosmetic categories:

- piece materials and silhouettes
- dice skins and visual trails
- board themes that preserve tile, safe-zone, and path readability
- profile frames and nameplates
- emote packs
- victory effects
- optional sound packs

Avoid skins that obscure piece counts, legal moves, safe zones, or team
identity. Cosmetics must not alter collision size, animation timing, dice
results, movement, or any game rule.

## Monetization Options by Priority

| Priority | Option | CrazyGames | Standalone web | Notes |
| --- | --- | --- | --- | --- |
| 1 | Deterministic cosmetic store | Invite-only IAP or earned unlocks | Stripe or earned unlocks | Best fairness/revenue fit |
| 2 | Rewarded ads for fixed Temple Coins | Full Launch only | Supported provider | Voluntary; daily cap |
| 3 | Founder/supporter pack | Only through approved CG IAP | Stripe | Cosmetics plus profile badge |
| 4 | Seasonal cosmetic track | Earned and optional premium path | Earned and optional premium path | No gameplay boosts |
| 5 | Ad-free supporter upgrade | Usually unnecessary | Stripe | Applies only to standalone ads |
| 6 | Cosmetic subscription/VIP | Only if IAP approved | Stripe subscription | Cosmetics/QoL only |
| 7 | Limited seasonal collections | If approved | Stripe | Avoid false scarcity |

Additional retention systems that can support, but should not distort, the
economy include quests, progression milestones, non-paid achievements,
referrals with abuse controls, and community tournaments with fixed
non-cashable rewards.

### Do not build

- cash-out, currency transfer, or player-to-player trading
- purchased currency as match entry or a prize
- client-calculated entry pools, fees, refunds, or payouts
- entry pools funded by purchased currency
- paid rerolls, favorable dice, extra moves, shields, or other gameplay power
- paid random rewards, loot boxes, or gacha
- ads before the first match or during an active turn
- ad chains or a rewarded-ad flow with no free alternative
- banners over the board or controls
- entry fees for Play with Friends or CrazyGames Instant Multiplayer

## Ad Placement

Good natural breaks:

- after a completed match, before the next lobby is created
- after several completed matches, subject to platform pacing
- a player-initiated “earn coins” action outside active gameplay

Bad placements:

- app startup before the player reaches the menu
- between a dice roll and move
- during reconnect, seat claiming, or an invitation join
- as a condition for claiming an already-earned match reward
- banner overlays on the board

Rewarded ads must state the exact reward before the player opts in. An ad error,
ad blocker, no-fill response, or CrazyGames Basic Launch status must leave the
game usable and must not grant an unverified reward.

## Required Backend Before Economy Launch

Introduce a trusted backend boundary before balances or inventory have value:

1. Verify identity server-side. For CrazyGames, exchange the short-lived user
   token through a Firebase Cloud Function and issue a custom Firebase token.
2. Make match start and completion authoritative, or verify the complete action
   log and result on a trusted server.
3. Store balances as a derived value from an append-only wallet ledger.
4. Use database transactions and an idempotency key for every grant, spend,
   refund, settlement, and purchase.
5. Fulfill Stripe and CrazyGames purchases from verified webhooks, never from a
   client success callback.
6. Keep the product catalog server-controlled and prevent arbitrary inventory
   writes through security rules.
7. Add fraud limits, audit tooling, support adjustments, and reconciliation.

Design-only record shapes:

```text
wallets/{uid}
  templeCoins
  gems
  version
  updatedAt

walletLedger/{entryId}
  uid
  currency
  delta
  reason
  referenceId
  idempotencyKey
  createdAt

inventory/{uid}/items/{itemId}
  productId
  source
  acquiredAt

matchSettlements/{matchId}
  rulesVersion
  participants
  result
  settlementStatus
  settlementIds
```

An idempotency key such as `match:{matchId}:settlement:{uid}` prevents duplicate
payouts after retries or reconnects.

## Compliance Boundaries

Before enabling any paid feature:

- publish terms, privacy information, refund handling, pricing, and virtual
  currency disclosures
- collect consent where required for personalized advertising
- determine VAT/GST/sales-tax obligations for digital goods
- provide account deletion and purchase-support paths
- apply age-appropriate design and avoid manipulative scarcity
- obtain jurisdiction-specific legal review before combining entry fees,
  chance-influenced outcomes, and prizes

Even when a currency has no cash-out, entry plus outcome-dependent prizes can be
regulated differently by location. This plan uses earned-only soft currency for
the normal public queue and keeps paid cosmetics in a completely separate
currency or direct-purchase catalog.

## Metrics and Economy Tuning

Measure separately by platform and queue:

- matches per player, completion rate, reconnect success, and forfeit rate
- Day 1/7/30 retention
- source and sink totals per active player
- median balance and percentage of players at zero
- reward-ad opt-in, completion, no-fill, and downstream match rate
- store view, preview, purchase, equip, and refund rates
- repeat-opponent rate and suspicious settlement clusters
- payer conversion and average revenue per paying user
- fairness sentiment and queue abandonment after introducing entry costs

A healthy soft economy should not continually inflate:

```text
net issuance = daily + quests + ads + promotions
               - public match fees - cosmetic sinks - expirations
```

Review net issuance weekly during rollout and version all economy values so
past settlements can be reconstructed.

## Rollout

### Phase A — foundations

- add server-verified identity and authoritative match settlement
- add ledger, product catalog, inventory, and audit tooling
- separate `seatColor` from `pieceSkinId`
- ship several free skins to validate readability and duplicate-skin behavior

### Phase B — earned economy

- add the automatic 500-coin daily-login grant
- add rewarded-ad coin grants only where platform status permits
- add cosmetic sinks and observe source/sink telemetry
- keep public entry disabled while validating wallet integrity

### Phase C — platform monetization

- CrazyGames: enable ads only after Full Launch approval; apply for IAP if the
  catalog and retention justify it
- standalone: add Stripe-hosted cosmetic checkout and webhook fulfillment
- add rewarded ads only after consent, fraud limits, and free alternatives

### Phase D — public Online Match entry

- run economy simulation and a limited experiment
- enable the 500-coin entry, 10% fee, and 90% winner pool payout
- keep offline, Play with Friends, and Instant Multiplayer free
- stop or rebalance if entry costs reduce healthy match completion or create
  zero-balance lockout

## UI and Playwright Acceptance Plan

The client MVP includes a balance badge, automatic daily reward notice,
public-match fee disclosure, insufficient-balance handling, and victory
settlement summary. Continued Playwright coverage should include:

- Basic Launch has no working ad or purchase controls
- normal public Online Match requires 500 coins
- a two-player completion deducts 500 from each player, records a 100-coin fee,
  and awards 900 to the winner
- a losing player receives no pool payout
- the first eligible daily login grants exactly 500 coins once
- rewarded-ad success grants the configured amount while cancel/error grants
  nothing
- CrazyGames Instant Multiplayer can start with a zero balance
- Play with Friends never requests an entry fee
- duplicate piece skins retain unmistakable seat-color and pattern markers
- long cosmetic/player names use ellipsis without covering controls
- purchase success in the browser does not grant inventory until the backend
  confirms it
- repeated settlement callbacks do not duplicate rewards
- ad cancel, no-fill, SDK failure, and ad blocker preserve the free path
- mobile and desktop store layouts do not overlap the board

The current local UI baseline covers menu navigation, game start, victory,
multiplayer entry, and long-name layout. It provides the regression foundation
for these future tests.

## Authoritative References

- [CrazyGames launch and monetization requirements](https://docs.crazygames.com/requirements/intro/)
- [CrazyGames advertising requirements](https://docs.crazygames.com/requirements/ads/)
- [CrazyGames video ads](https://docs.crazygames.com/sdk/video-ads/)
- [CrazyGames midgame ad pacing](https://docs.crazygames.com/resources/midgame-ads-pacing/)
- [CrazyGames in-game purchases](https://docs.crazygames.com/sdk/in-game-purchases/)
- [CrazyGames application-type limitations](https://docs.crazygames.com/resources/crazygames-app/)
- [CrazyGames backend user tokens](https://docs.crazygames.com/sdk/html5-v2/user/)
- [CrazyGames Firebase user linking](https://docs.crazygames.com/sdk/html5-v2/user-linking/)
- [CrazyGames multiplayer requirements](https://docs.crazygames.com/requirements/multiplayer/)
- [CrazyGames SDK local and preview testing](https://docs.crazygames.com/sdk/intro/)
- [Stripe Checkout](https://docs.stripe.com/payments/checkout)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Stripe webhook security](https://docs.stripe.com/webhooks)
- [Stripe Tax calculations](https://docs.stripe.com/tax/calculating)
- [Google Ad Manager rewarded ads for web](https://support.google.com/admanager/answer/9116812?hl=en)
- [Google rewarded inventory policy](https://support.google.com/admanager/answer/7496282?hl=en)
- [India IT Rules online gaming amendment (2023)](https://www.meity.gov.in/static/uploads/2024/02/244980-Gazette-Notification-for-IT-Amendment-Rules-2023-relating-to-online-gaming-false-information-about-Govt.-business.pdf)
- [India Promotion and Regulation of Online Gaming Act (2025)](https://www.meity.gov.in/static/uploads/2025/10/8a7f103cefc68ed8aaa2ebc9a2ed7c13.pdf)
