# Dyut Board Game: Future Enhancements & Monetization Plan

This document outlines the roadmap for transitioning Dyut into a publicly scalable and monetizable product. It details the required features and the necessary configuration changes.

---

## Phase 26: Monetization Strategies (Revenue)

### 26.1 Virtual Currency & Wagers (Soft Economy)
*   **Objective:** Introduce "Dyut Coins" to create stakes and an in-game economy.
*   **Implementation Steps:**
    1.  **Database Update:** Add `coins` (default: 1000) and `lastDailyReward` timestamp to the Firestore `users` schema.
    2.  **Daily Reward UI:** Create a modal (`DailyReward.jsx`) that checks `lastDailyReward` on login. If 24 hours have passed, offer a button to claim daily coins.
    3.  **Lobby Wagers:** Update `UnifiedLobby.jsx`. Add a "Wager Amount" selector for hosts. Deduct the entry fee from all joining players' balances and move it to a `pot` field in the lobby document.
    4.  **Payout Logic:** Update `GameContext.jsx` (or backend functions) so that when a game reaches `status: 'finished'`, the winner is awarded the total pot minus a 5-10% game sink/rake to balance the economy.

### 26.2 Cosmetic Store (In-App Purchases)
*   **Objective:** Sell premium visual upgrades.
*   **Implementation Steps:**
    1.  **Payment Gateway Integration:** Install Stripe (for web) and RevenueCat (for Capacitor mobile).
    2.  **Schema Update:** Add `inventory: []` and `equipped: { pieceSkin, boardTheme }` to the `users` collection.
    3.  **Store UI:** Build `StoreScreen.jsx` with tabs for "Piece Skins", "Board Themes", and "Dice Trails". Fetch products from a secure Firestore collection.
    4.  **Asset Mapping:** Update `Board.jsx` to read the equipped themes from the player's profile and dynamically swap CSS classes (e.g., replacing `.bg-piece-yellow` with `.bg-skin-obsidian`).

### 26.3 Ad Integration (AdMob / AdSense)
*   **Objective:** Generate revenue from non-paying users.
*   **Implementation Steps:**
    1.  **Plugin Setup:** Install `@capacitor-community/admob`. Initialize it in `App.jsx` based on the platform.
    2.  **Rewarded Ads:** Add a "Watch Ad for 500 Coins" button in the Store and Lobby. Trigger `AdMob.showRewardVideoAd()`, and upon success, trigger a Cloud Function to credit the user.
    3.  **Banner Ads:** Configure a persistent banner ad at the bottom of the `UnifiedLobby.jsx` screen.
    4.  **Premium Flag:** Implement a one-time "Remove Ads" IAP. If `user.isPremium` is true, bypass all AdMob initialization logic.

---

## Phase 27: Player Retention & Engagement

### 27.1 Progression System (XP & Levels)
*   **Objective:** Give players a sense of long-term achievement.
*   **Implementation Steps:**
    1.  **Schema Update:** Add `xp` and `level` fields to the user profile.
    2.  **XP Calculation Logic:** Create a helper function `calculateMatchXP(stats)` that awards XP based on match outcome, pieces captured, and game length.
    3.  **Level Up UI:** In `VictoryScreen.jsx`, display an XP progress bar. If XP crosses a threshold, trigger a "Level Up!" animation.
    4.  **Milestone Rewards:** Automatically credit basic cosmetic unlocks to the user's `inventory` when specific levels are reached.

### 27.2 Global & Regional Leaderboards
*   **Objective:** Foster competition.
*   **Implementation Steps:**
    1.  **Cloud Function (Cron Job):** Create a scheduled Firebase Cloud Function that runs hourly. It queries the top 100 users by `wins` or `xp` and writes the result to a single document: `leaderboards/global`.
    2.  **UI Implementation:** Build `LeaderboardScreen.jsx`. Fetch the single `leaderboards/global` document (to save read costs) and render the ranked list.

### 27.3 Daily Quests
*   **Objective:** Encourage daily logins through micro-goals.
*   **Implementation Steps:**
    1.  **Quest Pool:** Define a backend array of quests (e.g., `{ id: 'capture_3', target: 3, reward: 200 }`).
    2.  **Daily Assignment:** On login, if `lastQuestReset` is older than 24 hours, randomly select 3 quests and save them to the user's `activeQuests` subcollection.
    3.  **Progress Tracking:** At the end of a match, evaluate the match stats against the active quests and increment their progress.
    4.  **Claim UI:** Add a "Quests" slide-out panel where users can click "Claim" on completed quests to receive coins.

---

## Phase 28: Social Features & Viral Loops

### 28.1 Expressive Quick Chat / Emotes
*   **Objective:** Allow safe player interaction without heavy moderation.
*   **Implementation Steps:**
    1.  **State Update:** Add an `activeEmote: { playerId, emoteId, timestamp }` object to the `GameContext` state.
    2.  **UI Picker:** Add a small smiley-face button next to the player's avatar in the `PlayerBase` component. Clicking it opens a radial menu of allowed emojis/stickers.
    3.  **Animation:** When an emote is dispatched to the state, render a floating animation over the user's avatar. Use a `setTimeout` to clear it after 3 seconds.

### 28.2 Shareable Match Summaries
*   **Objective:** Leverage user networks for free marketing.
*   **Implementation Steps:**
    1.  **Library Integration:** Install `html2canvas`.
    2.  **Capture Logic:** In `VictoryScreen.jsx`, add a "Share Win" button. When clicked, temporarily render a hidden styled div containing the final board state and stats.
    3.  **Web Share API:** Convert the canvas to a Blob and invoke `navigator.share({ title: 'I just won at Dyut!', files: [imageFile] })`.

### 28.3 Referral Rewards
*   **Objective:** Incentivize invites.
*   **Implementation Steps:**
    1.  **Deep Linking:** Use Firebase Dynamic Links to generate URLs like `https://dyut.game/?ref=USER_UID`.
    2.  **Attribution:** On app load, check for the `ref` URL parameter. If present and the user is creating a *new* account, store the `referredBy` UID.
    3.  **Reward Fulfillment:** Trigger a Cloud Function to grant 500 Coins to both the referrer and referee.

---

## Phase 29: Infrastructure & Anti-Cheat

### 29.1 Server-Side Authority
*   **Objective:** Prevent cheating (client-side logic manipulation, fake dice rolls).
*   **Implementation Steps:**
    1.  **Backend Migration:** Move `gameLogic.js` (including `getValidMoves` and `applyCombat`) into a Firebase Cloud Functions environment.
    2.  **Action Handlers:** Create callable cloud functions for `rollDice` and `executeMove`.
    3.  **Client Refactor:** Instead of clients calculating the new state and updating Firestore directly, they will call the backend function with their intent. The server rolls the dice, validates the move against its own state, and writes the authoritative result to the database.

### 29.2 Cost Optimization (Migrate active games to RTDB)
*   **Objective:** Drastically lower database bills for high-frequency multiplayer updates.
*   **Implementation Steps:**
    1.  **Initialize RTDB:** Enable Firebase Realtime Database in the console.
    2.  **Adapter Rewrite:** In `GameContext.jsx`, replace `onSnapshot` (Firestore) with `onValue` (RTDB) for listening to game state.
    3.  **Update Logic:** Replace `updateDoc` with `set()` or `update()` from the RTDB SDK.
    4.  **Data Segregation:** Keep permanent data (User Profiles, Match History, Cosmetics) in Firestore, while ephemeral data (active turn queue, piece positions) lives in RTDB and is deleted when the match ends.

---

## Phase 30: App Store & Legal Compliance

### 30.1 Account Deletion
*   **Objective:** Meet mandatory Apple/Google app store requirements.
*   **Implementation Steps:**
    1.  **UI Addition:** Add a red "Delete Account" button in the `PlayerProfile` component.
    2.  **Confirmation Dialog:** Require the user to type "DELETE" into a prompt to prevent accidental triggering.
    3.  **Auth Wipe:** Call `auth.currentUser.delete()` via the Firebase SDK.
    4.  **Data Wipe Function:** Create an `onUserDeleted` Firebase Cloud Function that automatically finds and deletes the user's record in the `users` collection to comply with data privacy laws.

### 30.2 Privacy Policy & GDPR Consent
*   **Objective:** Ensure legal tracking and ad compliance in Europe/California.
*   **Implementation Steps:**
    1.  **Static Pages:** Create `PrivacyPolicy.jsx` and `TermsOfService.jsx` outlining data usage (Google Auth emails, basic telemetry).
    2.  **Consent Banner:** Install a library like `react-cookie-consent`. On the first visit, display a banner.
    3.  **Conditional Tracking:** If the user declines, disable Firebase Analytics and AdMob personalized ad tracking.