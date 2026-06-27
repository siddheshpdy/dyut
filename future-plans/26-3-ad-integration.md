# Phase 26.3: Ad Integration Plan

## Objective

Add ad monetization for non-premium users while preserving portal compliance, gameplay flow, and user trust.

## Why This Matters

Ads provide revenue before in-app purchases mature. The current CrazyGames Basic Launch build deliberately disables ad calls, so this plan focuses on adding ads in controlled platform-specific paths.

## Current Touchpoints

- `App.jsx`: portal SDK and midgame ad trigger
- `UnifiedLobby.jsx`: banner locations and profile/menu flow
- `VictoryScreen.jsx`: replay path
- `.env.crazygames`: `VITE_CG_ENABLE_ADS`
- Future Capacitor app files

## Platform Strategy

- CrazyGames: use CrazyGames SDK only after Full Implementation approval.
- Web: consider AdSense only if allowed by hosting and UX constraints.
- Android/iOS: use AdMob through Capacitor plugin.
- Premium users: skip all ad initialization and ad requests.

## Data Model

Firestore `users/{uid}` additions:

- `isPremium: boolean`
- `adRewardsClaimed: number`
- `lastRewardedAdAt: timestamp | null`

Environment flags:

- `VITE_CG_ENABLE_ADS`
- `VITE_ADMOB_ENABLED`
- `VITE_ADSENSE_ENABLED`

## Implementation Steps

1. Keep ad calls disabled by default in Basic Launch builds.
   Why: CrazyGames rejects Basic Launch submissions that call ad APIs.

2. Add a platform ad adapter such as `adService.js`.
   Why: components should call `showInterstitial` or `showRewarded` without knowing CrazyGames, AdMob, or AdSense details.

3. Add premium checks before ad initialization.
   Why: premium users should not load or trigger ad SDKs.

4. Add rewarded ad entry points in Store and Lobby.
   Why: rewarded ads work best when user-initiated and tied to coins.

5. Add interstitial ads only at natural breaks.
   Why: ads during active turns would hurt game quality and may violate portal expectations.

6. Add banner ads only where layout has reserved space.
   Why: portal iframes and mobile screens are sensitive to overlap and accidental clicks.

7. Add server-side reward crediting.
   Why: ad rewards should not be granted solely by client-side callbacks.

## Security Notes

- Rewarded ad coin grants should be callable Cloud Functions with cooldowns.
- Never trust a client callback alone for premium or coin state.
- Keep portal ads behind `VITE_CG_ENABLE_ADS=true`.

## Tests

- Unit test ad adapter no-op paths when disabled.
- Manual test CrazyGames Basic build contains no ad API strings.
- Manual test rewarded ad success/error/cancel callbacks.
- Layout tests for banner placement on desktop and mobile.

## Rollout Plan

1. Keep current Basic Launch no-ad build.
2. Add adapter and premium flags.
3. Enable rewarded ads behind feature flag.
4. Enable interstitial and banners after platform approval.

## Dependencies

- Phase 26.1 coins for rewarded ad payouts.
- Phase 30.2 consent system before personalized ads.
