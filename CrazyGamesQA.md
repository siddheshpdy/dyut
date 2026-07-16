# CrazyGames QA Checklist

Use this checklist before uploading a new CrazyGames build or enabling a new portal capability.

## Build

- Run `npm.cmd test`.
- Run `npm.cmd run build:crazygames`.
- Upload the contents of `dist/`.
- Confirm `dist/index.html` uses relative asset paths such as `./assets/...`.
- Confirm the zipped build is comfortably below CrazyGames limits.

## Required Viewports

Test gameplay, menu, lobby, tutorial overlay, resume dialog, victory screen, and compact landscape layout at:

- `1920 x 1080`
- `1366 x 768`
- `1080 x 607`
- `907 x 510`
- `821 x 462`
- `800 x 450`
- `768 x 1024`
- `430 x 932`
- `390 x 844`
- `360 x 800`

For each viewport:

- No horizontal page scroll.
- No clipped action buttons.
- No unreadable black text on dark backgrounds.
- Dice tray, queue, and timer do not overlap.
- Active player's base pieces are visible when compact landscape layout is used.
- Victory screen covers the full viewport and blocks gameplay behind it.

## CrazyGames SDK

- SDK script loads only in `VITE_IS_PORTAL=true` builds.
- `loadingStart()` runs during SDK initialization.
- `loadingStop()` runs after app setup.
- `gameplayStart()` fires only when active gameplay starts.
- `gameplayStop()` fires on victory, menu return, or unmount.
- `happytime()` fires on victory when supported.
- `muteAudio` from `CrazyGames.SDK.game.settings` keeps game audio muted even if the user presses the in-game mute button.

## Multiplayer

- Public matchmaking creates or joins a waiting lobby.
- Private lobby creates an invite link with `CrazyGames.SDK.game.inviteLink`.
- Native invite button appears while a private lobby is active.
- Invite-link users land directly in the waiting lobby or active gameplay.
- `CrazyGames.SDK.game.isInstantMultiplayer=true` creates a private joinable 1v1 lobby without showing onboarding or the main menu.
- Instant-multiplayer party leaders appear in the lobby as the first claimed human seat.
- `updateRoom()` reports `playerCount`, `maxPlayerCount`, `isJoinable`, and `inviteParams`.
- `leftRoom()` is called when leaving menu/game flows that abandon the room.
- CrazyGames usernames appear in seats and on the board.
- Host migration keeps the game playable after host disconnect.
- Public match reconnect prevention replaces disconnected players with bots.

## Save And Resume

- Offline portal game state is saved through CrazyGames Data under `dyut_offline_resume`.
- Starting a new offline game clears the old offline resume.
- Finishing an offline game clears the offline resume.
- Resume Existing loads the saved offline state.
- New Game clears the saved offline state and starts fresh.
- Go to Menu closes the dialog without changing the saved state.
- Private online resume still uses the account/device reconnect target.

## Ads

Only test this when `VITE_CG_ENABLE_ADS=true`.

- Midgame ad request does not fire during initial loading.
- Audio mutes when an ad starts.
- Audio restores to the effective user/platform mute state when an ad finishes or errors.
- Victory Play Again ad returns to the menu/new-game flow after the ad finishes or errors.
- Banner containers render only on large desktop screens and do not cover UI.

## Mobile Touch

- Page text does not become accidentally selected while tapping/dragging.
- Inputs still allow text selection, copying, and invite-link copying.
- Buttons have responsive tap targets.
- Dice roll and move selection work with touch.
- Tutorial quick tip remains skippable and does not block first gameplay.

## Submission Fields

- Progress save: select CrazyGames Data Module only after verifying portal offline resume in Data.
- Supports mobile devices: yes, after the required viewport pass.
- Mobile orientation: both.
- Online multiplayer: yes, if public/private lobby and invite flow pass.
- Instant Multiplayer: yes after the instant-multiplayer private lobby flow passes QA.
- Mute audio through SDK: yes, after `muteAudio` verification.
