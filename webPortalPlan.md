# Dyut Board Game: Web Portal Integration Plan (CrazyGames / Poki)

Publishing to web portals requires adhering to strict iframe security policies, using proprietary SDKs for monetization, and isolating the build environment. This document outlines the roadmap for preparing Dyut for CrazyGames and similar platforms.

## Phase 31: Environment & Build Configuration
*   **Objective:** Create a dedicated build pipeline that strips out incompatible features (like out-of-game links) without affecting the main web or Android builds.
*   **Implementation Steps:**
    1.  **Environment Variables:** Create a `.env.crazygames` file with `VITE_IS_PORTAL=true`.
    2.  **Vite Config:** Update `package.json` with a new build script: `"build:crazygames": "vite build --mode crazygames"`. Ensure `vite.config.js` uses `base: './'` so all asset paths are relative (required for portal zip uploads).
    3.  **UI Toggles:** Wrap external links (Portfolio, Socials) and unsupported authentication methods (Google Sign-In popup) in `if (!import.meta.env.VITE_IS_PORTAL)` checks.

## Phase 32: SDK Integration & Ad Monetization
*   **Objective:** Implement the required portal SDKs for gameplay tracking and revenue generation.
*   **Implementation Steps:**
    1.  **SDK Inclusion:** Add the CrazyGames SDK script to `index.html` (conditionally injected during the portal build, or initialized safely in React).
    2.  **Gameplay Tracking:** Dispatch `CrazyGames.SDK.game.gameplayStart()` when the board loads, and `gameplayStop()` on the Victory Screen.
    3.  **Interstitial Ads:** Trigger an interstitial ad request when the user transitions from the Victory Screen back to the Main Menu.
    4.  **Rewarded Ads (Optional):** Replace the AdMob implementation in the UI with `CrazyGames.SDK.ad.requestAd('rewarded')` to allow users to earn in-game coins.

## Phase 33: Data & State Management Strategy
*   **Objective:** Handle iframe restrictions where third-party cookies (Firebase Auth) might be blocked by the browser.
*   **Implementation Steps:**
    1.  **Persistent Storage (Progression):** Since Firebase Auth might fail inside an iframe on strict browsers, implement a wrapper around user progression (coins, skins, stats).
        *   *Logic:* `if (VITE_IS_PORTAL) { use CrazyGames.SDK.data } else { use Firestore users collection }`.
    2.  **Real-Time Multiplayer (Live State):** Continue using **Firebase Realtime Database (RTDB)** for active match syncing (`lobbies` and `games` nodes). CrazyGames does not provide multiplayer servers, so Firebase RTDB remains essential.
    3.  **Anonymous Auth Fallback:** For portal users playing online, force Firebase Anonymous Authentication to bypass popup blockers while still generating a valid `uid` for Firebase Security Rules.

## Phase 34: Packaging & QA Compliance
*   **Objective:** Meet the strict QA guidelines of game portals.
*   **Implementation Steps:**
    1.  **Asset Sizing:** Ensure the final `dist/` folder is optimized (ideally under 10MB) to ensure fast loading inside iframes.
    2.  **Sizing Constraints:** Ensure the game layout uses `100vw` and `100vh` strictly without relying on window scrolling, as portal iframes hide scrollbars.
    3.  **Zip Creation:** Create an automated script to zip the `dist/` folder for easy upload to the CrazyGames developer dashboard.
    4.  **Marketing Assets:** Prepare 512x512 icons, banner graphics, and a short gameplay trailer for the portal store page.