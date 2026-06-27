# Phase 30.2: Privacy Policy & GDPR Consent Plan

## Objective

Add Terms of Service, Privacy Policy, and consent handling for analytics, ads, authentication, and regional privacy expectations.

## Why This Matters

The app uses Firebase auth/profile data and may later use ads, purchases, leaderboards, referrals, and analytics. Users need clear disclosure and control where required by law and platform policy.

## Current Touchpoints

- `App.jsx`: top-level route/view switching
- `UnifiedLobby.jsx`: main menu/header
- `AboutScreen.jsx`: contact/about page
- `index.html`: metadata
- Firebase Auth and Firestore
- CrazyGames portal build

## Required Pages

- `PrivacyPolicy.jsx`
- `TermsOfService.jsx`
- Optional `LegalScreen.jsx` wrapper

Policy topics:

- account data
- anonymous auth
- Google sign-in
- gameplay stats
- online multiplayer data
- portal SDK data
- ads and rewarded ads
- purchases
- referrals
- leaderboards
- account deletion
- contact/support

## Consent Data Model

Local storage:

- `dyut_consent_version`
- `dyut_consent_analytics`
- `dyut_consent_ads`

Firestore user profile:

- `consent: { version, analytics, personalizedAds, updatedAt }`

## Implementation Steps

1. Draft privacy and terms pages.
   Why: legal text should exist before consent UI asks users to agree.

2. Add in-app navigation to legal pages.
   Why: policies must be accessible after first consent.

3. Add consent banner for web builds.
   Why: users in regulated regions need a clear choice before analytics or personalized ads.

4. Add consent state helper module.
   Why: Firebase analytics, ads, and future tracking should share one consent source.

5. Gate analytics and personalized ads behind consent.
   Why: privacy choices must affect actual SDK behavior.

6. Add portal-specific legal note.
   Why: portal users also need in-game mention of CrazyGames legal terms.

7. Add account deletion instructions.
   Why: privacy pages should explain how users remove data.

## Security and Compliance Notes

- This plan is engineering guidance, not legal advice.
- Real policy text should be reviewed before public launch.
- Consent versioning is required when terms materially change.
- Do not load personalized ad SDKs before consent when required.

## Tests

- Component tests for legal page rendering.
- Unit tests consent helper defaults and updates.
- Manual test accepting, declining, and resetting consent.
- Manual portal build check for legal mention.

## Rollout Plan

1. Add static legal pages.
2. Add non-blocking legal links.
3. Add consent banner.
4. Wire consent into ads/analytics.

## Dependencies

- Required before full ad integration.
- Should launch before app store submission.
