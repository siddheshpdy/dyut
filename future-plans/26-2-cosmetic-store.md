# Phase 26.2: Cosmetic Store Plan

## Objective

Add a store where players can unlock and equip cosmetic piece skins, board themes, and dice effects without changing gameplay rules.

## Why This Matters

Cosmetics monetize and personalize the game while keeping Dyut fair. They also give coins, quests, progression, ads, and referrals a meaningful reward sink.

## Current Touchpoints

- `UnifiedLobby.jsx`: profile/menu entry point
- `Board.jsx`: piece and board tile rendering
- `DiceTray.jsx`: dice visuals and roll animation
- `firebaseSetup.js`: user profile schema
- `index.css` and `tailwind.config.js`: visual tokens and class mapping
- Firestore `users` collection

## Data Model

Firestore `users/{uid}` additions:

- `inventory: string[]`
- `equipped: { pieceSkin: string, boardTheme: string, diceTrail: string }`
- `purchaseHistory: { productId, purchasedAt, source }[]`

Firestore `storeProducts/{productId}`:

- `id`
- `type: "pieceSkin" | "boardTheme" | "diceTrail"`
- `name`
- `description`
- `priceCoins`
- `priceRealMoney`
- `assetKey`
- `isActive`
- `sortOrder`
- `platforms`

## Implementation Steps

1. Define cosmetic asset keys and default equipment constants.
   Why: rendering must have stable fallbacks for anonymous users, missing products, and old saves.

2. Extend user profile initialization with `inventory` and `equipped`.
   Why: profile reads should not need null checks throughout the UI.

3. Create a `cosmeticsService.js` module.
   Why: purchasing, equipping, product reads, and inventory checks should not be embedded in rendering components.

4. Build `StoreScreen.jsx` with tabs for piece skins, board themes, and dice trails.
   Why: store browsing is a distinct view and should not make `UnifiedLobby.jsx` larger.

5. Add a Store button to the lobby/profile area.
   Why: cosmetics are account-level features, not in-match actions.

6. Refactor visual mapping in `Board.jsx` into small helper functions.
   Why: skins should map from player profile data to CSS classes without changing movement or combat logic.

7. Add dice effect hooks to `DiceTray.jsx`.
   Why: dice trails are visual only and should stay isolated from dice result generation.

8. Add Stripe or platform purchase flow only after coin purchases are stable.
   Why: real-money purchases require receipt validation and legal review.

## Security Notes

- Real-money unlocks must be verified server-side before adding inventory.
- Firestore rules must prevent users from writing arbitrary inventory items.
- Product definitions should be read-only to clients.

## Tests

- Unit test inventory and equip validation helpers.
- Component test Store tab rendering and disabled states.
- Manual visual test all skins on desktop/mobile board.
- Regression test default board rendering with no profile.

## Rollout Plan

1. Ship free/default cosmetics and equip UI.
2. Add coin-purchased cosmetics.
3. Add real-money products after server-side receipt validation exists.

## Dependencies

- Benefits from Phase 26.1 coins.
- Required by progression milestone rewards and possibly daily quests.
