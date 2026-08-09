# UI and Functionality Preservation Contract

## Mandatory use

Read this document before changing any UI, feature flow, state transition, portal integration, economy rule, or responsive layout. It records the currently shipped product contract, not a list of optional ideas.

Unless the user explicitly asks to remove, replace, or move an item:

- Preserve every feature, control, route, modal, feedback message, and visibility condition listed here.
- Treat an element that is conditionally hidden as still required. Preserve its trigger and condition.
- Do not replace a feature with a visually similar one that loses a capability (for example, replacing the Rewards dialog with a coin number, or replacing Collection with a seat dropdown).
- Keep controls accessible by keyboard and a meaningful `aria-label` where the control is icon-only.
- Do not change game rules. Read `LogicAndRules.md` before changing game behaviour.
- For UI work, run the relevant tests and the viewport checklist in `CrazyGamesQA.md` before handoff.

When a requirement genuinely needs a move or removal, document the requested change in the PR/task summary and update this file in the same change.

## Sources of truth

| Area | Main implementation |
| --- | --- |
| Application routing, responsive game layout, in-game header and overlays | `App.jsx` |
| Main menu, configuration, seats, online lobby, account, rewards and Collection | `UnifiedLobby.jsx` |
| Board, pieces, player bases, move-selection entry point and victory trigger | `Board.jsx` |
| Dice, active player, timer, queue and AFK status | `DiceTray.jsx` |
| Movement-choice dialog | `MoveSelector.jsx` |
| Game state, online synchronization, timers and settlement hooks | `GameContext.jsx` |
| Economy state, daily rewards, goals and public-match settlement | `EconomyContext.jsx`, `economy.js`, `economyService.js` |
| Piece design catalogue and ownership rules | `pieceSkins.js` |
| Secondary information screens | `RulesScreen.jsx`, `HistoryScreen.jsx`, `TutorialScreen.jsx`, `AboutScreen.jsx`, `SecondaryScreenShell.jsx` |
| Screen-size QA requirements | `CrazyGamesQA.md` |

`MainMenu.jsx` and `GameSetup.jsx` exist in the repository but are not mounted by `App.jsx`. Do not treat them as the current product UI or reintroduce them without an explicit requirement.

## Product modes and screen ownership

`App.jsx` owns one active view at a time:

| View | Entry | Required contents |
| --- | --- | --- |
| `menu` | Default; leaving a game; Home | `UnifiedLobby` and its header, main/menu/setup/lobby states, rewards and Collection |
| `game` | Start, resume, rejoin, QA scenario | Board, dice tray, game header, first-game helper when eligible, information overlay, victory overlay when won |
| `rules` | Lobby navigation | Rules screen and Return button |
| `history` | Lobby navigation | History screen and Return button |
| `tutorial` | Lobby navigation | Interactive tutorial screen and Return button |
| `about` | Lobby navigation | About screen and Return button |

Development-only QA query values are intentional: `qa=scenario`, `qa=long-name`, `qa=resume`, and `qa=victory`. Keep them usable for automated visual checks unless a replacement is requested.

There are two deployment modes:

- **Standalone:** Firebase authentication, local/public/private entry points, Void Rule option, mail contact link.
- **CrazyGames portal** (`VITE_CRAZYGAMES_BUILD=true`): CrazyGames SDK identity/data/audio flow, portal menu labels, portal legal notice, no Void Rule option, portal-specific first-session/instant-multiplayer entry.

## Persistent lobby header

The lobby header is fixed at the top of every `UnifiedLobby` state: main menu, configuration, local seats, and online lobby. Its left side contains only the non-critical navigation toggle, leaving space for CrazyGames platform overlays and device safe areas. Do not remove it while navigating between those states.

| Placement | Element | Visibility / behaviour |
| --- | --- | --- |
| Top, centred safe area | DYUT title and tagline | Always visible. It replaces the former duplicate central lobby title. |
| Top utility group | Treasury control (Temple Coin balance + Rewards) | Always visible after economy loading. It combines the balance and Rewards trigger; the availability dot indicates a claimable daily reward and opens Daily Reward/Goals. Do not split it back into separate header controls. |
| Top utility group | Collection | Always visible. It opens Piece Collection; it must not be folded into a non-obvious control or removed because seat cards also have design selectors. |
| Top utility group | Player account and W/P | Standalone: placeholder while user data is unavailable, then profile/sign-in. Portal: CrazyGames sign-in/profile. A signed-in profile shows username and wins/played (`W / P`). |
| Top utility group | Mute/unmute icon | Always visible. It reflects effective audio state and must remain usable in both build modes. |
| Top-left, non-critical | Menu toggle | Opens the grouped navigation drawer. It must remain an actual toggle and never cover the top-right game utilities. |
| Desktop home (`>=1280px`) | Persistent left navigation pane | Always shows How to Play, Rules, History, About Us, and Language. It reserves horizontal space for home actions. |
| Below desktop or outside home | Slide-out navigation drawer | The same five controls are available from the menu toggle. Closing the drawer or choosing an information screen closes it. |
| Top utility group outside home | Language selector | Also visible from 480px upward so language remains directly available in configuration and lobby states. |

At widths below 700px the top header uses compact right-aligned utilities beside the menu toggle; it must not overflow or use the top-left corner for critical controls. Do not add a new permanent header item at that width without rechecking all mobile viewports.

## Economy, rewards and Collection

These are live features, not decorative lobby elements.

### Rewards

The **Treasury control** opens a full-screen Rewards dialog. The dialog must retain:

- Daily reward amount and claim button/status. Claiming is allowed once per UTC day.
- Reward Goals list: daily win, daily capture, weekly win, and weekly capture; each shows progress and claim state/action.
- Claim error feedback.
- Optional reward-multiplier offer/result only when ads are enabled. A failed ad must not remove the base reward.
- Close control and scrollable content on short screens.

Both the Rewards dialog and multiplier dialog are rendered above the lobby or in-game header and navigation pane. Their top title, close control, and initial content must be visible at every supported viewport; they must not be clipped by a parent header or stacking context.

Visibility conditions:

- The claim button is visible only when the daily reward is available.
- A claimed-day status replaces it otherwise.
- Goal claim buttons appear only for claimable goals; other goals show progress or Claimed.

### Piece Collection

The **Collection** trigger opens a full-viewport modal with a fixed shell and an independently scrollable list. It is rendered above the header/navigation pane and must retain:

- Title, purpose text, current Temple Coin balance and a visible “scroll to browse every design” cue.
- A persistent Close button that remains visible after the list is scrolled.
- Classic design as free and always owned.
- Coin purchase or Equip action for each listed design; disabled actions while loading, when equipped, or when unaffordable.
- Insufficient-coin and other purchase errors.
- Equipped state for Player 1 and the ability to equip any previously owned design.

Current catalogue: Classic (free), Lotus (750), Chakra (1200), Royal (2000), Conch (3000), Peacock (4500), Eclipse (6500), Temple (9000), Celestial (12000). Prices and ownership are defined in `pieceSkins.js`.

Layout requirements:

- One column on narrow phones, two columns from `sm`, three columns at desktop (`lg`).
- The modal list scrolls when needed; do not let lower cards overflow or become unreachable.
- On compact heights, both the final design purchase action and Close button must remain reachable after scrolling.

## Main menu and recovery actions

The home action area is shown only when there is no active lobby and no setup mode. Its temple backdrop, ornamental card treatment, and responsive arrangement are presentation-only: they must never remove an action, alter its handler, or hide recovery feedback.

| Viewport range | Required home action arrangement |
| --- | --- |
| Narrow phones (`<700px`) | One vertical stack: primary offline/local action, online action, then friends action. The home action area may scroll internally if required, while the fixed header and bottom utility strip remain reachable. |
| Compact landscape / tablet (`700px`–`1099px`) | Two columns: the gold primary action spans the first row; online and friends share the second row. |
| Desktop (`>=1100px`) | Three equal action cards in one row. |

The responsive arrangement above is intentional. Do not turn it into a single desktop-only panel or use it as a reason to remove the header utilities or grouped navigation controls.

| Mode | Main actions | Conditions |
| --- | --- | --- |
| Standalone | Local Play, Online Match, Play With Friends | Always shown in initial menu. Local starts local setup; Online opens public setup; friends opens private setup. |
| CrazyGames | Play Now, Play Online, Play With Friends | Always shown in initial menu. Play Now starts/resumes an offline bot match; Play Online searches public FFA; friends creates private play. |
| Both | Resume Offline | Shown when local saved state and player count exist. |
| Both | Reconnect | Shown when a remembered online game id exists. |
| Both | Economy notice | Shown only for economy/entry failure feedback. |
| Portal only | Terms/privacy notice | Always shown beneath portal menu choices. |
| Initial/config states | Fair Play. Pure Dyut. panel | Visible below the central content on compact screens and fixed bottom-left on large desktop. |

Starting a local/online flow with an existing offline save must show the **Resume Game?** dialog. It contains Resume Existing, New Game and Go to Menu. Do not silently discard saved progress.

## Configuration and seats

Configuration is shown when `setupMode` is set and `setupStep === 'config'`; it is not an alternate main menu.

Required configuration controls:

- Back to the main menu.
- Match type: 1 vs 1, 2 vs 2, FFA 4P.
- Public-match fee disclosure for public setup; this must mention entry coins and the 10% fee/90% prize policy.
- Quick-game toggle.
- Void Rule toggle only outside the CrazyGames build.
- Bot difficulty controls (Easy/Hard) for non-public setup.
- Primary action: Find Match for public, Next for local, Create Lobby for private (labels may be translated, function must remain).

The local seat editor is shown only for standalone local setup after configuration. It contains Back, all four seat cards and Start Match.

Each active seat card must preserve:

- Player label and the **YOU** indicator where applicable.
- Human/Bot/Closed selector, subject to host/public-lobby edit permissions.
- Name input when active/editable.
- Piece-design selector for that player.
- Available colour choices.
- Claim Seat when an unclaimed private-online human seat can be claimed.
- Taken state for another user’s claimed human seat.

## Online lobby and invitations

An online lobby is active when `activeLobbyId` exists. It replaces the main/configuration panel and must retain:

- Public/Private lobby label, id, connection status, and public countdown/waiting state where applicable.
- Read-only invite URL plus Copy/Copied interaction.
- Seat layout and ownership/claim restrictions.
- Host Start Match action; non-host Waiting for Host state.
- Leave Lobby action at the bottom. This is required and must remain visible/reachable at short heights.
- CrazyGames room update/invite button handling in portal builds.

Public lobby behaviour includes automatic seat claiming, entry-fee checks/refunds and bot replacement/host auto-control. Private lobbies keep shareable invite/reconnect behaviour. Do not alter these flows without inspecting `UnifiedLobby.jsx`, `GameContext.jsx`, `matchmaking.js` and the corresponding tests.

## Secondary information screens

Rules, History and About use `SecondaryScreenShell`; keep its ornate title, content card, and Return action. The global mute icon remains available at top-left whenever the active app view is neither menu nor game.

| Screen | Required content |
| --- | --- |
| Rules | Dicing, Combat and Winning tabs; current tab content; Return. |
| History | Origins and Gameplay sections; Return. |
| About | Developer and Contact sections; standalone mail link; portal “Thank you for playing!” replacement; Return. |
| Tutorial | Interactive scenario board/dice plus instructions/progress and Return. Its own responsive board/tray layout must remain. |

When opened from an active game, these screens appear inside `GameInfoOverlay`, above gameplay, with its fixed Close button. Closing must return to the same game, not the lobby.

## Gameplay UI

### In-game header

Gameplay uses one edge-to-edge fixed header: 68px at desktop widths (`>=1200px`) and 60px below desktop. It has a flat dark background and a single gold bottom rule; do not restore the inset rounded header card.

| Placement | Element | Visibility / behaviour |
| --- | --- | --- |
| Top-left, non-critical | Menu toggle | Always visible. Opens the in-game navigation drawer containing How to Play, Rules, History, and About Us. Choosing an action closes the drawer. Do not restore these as four permanent desktop links. |
| Top, centred safe area | DYUT title | Always visible without an in-game tagline. It is visually centred in the viewport, independent of the utility widths. |
| Top utility group | Treasury control | Always visible after economy loading. In-game it appears as a gold coin and balance pill, but still opens the combined Rewards/Goals Treasury dialog; do not turn it into a non-interactive balance. |
| Top utility group | Score | Star, value, and `Score` label are visible from 700px upward. It may collapse below 700px to protect essential actions from overflow. |
| Top utility group | Mute/unmute | Always visible and reflects effective audio state. |
| Top utility group | Profile | Circular profile affordance is visible from 700px upward. |
| Top utility group | Exit | Always visible and retains the existing confirmation and leave/save behaviour. |

The menu, Treasury, score, mute, and exit are functionality-preserving relocations. Do not remove them or split Treasury back into separate balance and reward controls during future gameplay redesigns.

Exit always asks for confirmation. Leaving a public online match warns that the player will be bot-replaced and cannot rejoin; other games warn that progress is saved.

### Board

The board is a 19×19 logical grid. It must show track cells, global pieces, all applicable player bases, player names/status and active-turn highlighting.

- Full desktop (`>=1200px`, including short landscape windows): board is centred in the area left of a fixed right gameplay sidebar. The sidebar begins directly below the 68px header, extends to the viewport bottom, and uses a single gold left divider rather than a rounded outer card.
- Portrait/mobile: board occupies the flexible upper region; DiceTray is anchored below it.
- Compact landscape/tablet (`760px+` wide and `<=740px` high, below full desktop): board and the mobile-style DiceTray sit side-by-side. It retains the mobile active-piece holder and explicit queue with count so neither becomes hidden.
- Mobile bases normally omit the active base to preserve space; compact landscape intentionally passes `hideActiveBaseOnMobile={false}` so all bases stay visible.
- Player names/status stay outside and above their base cards. Desktop base cards reserve one horizontal row for all four starting pieces; do not switch them back to a 2×2 holder or place the name inside the card. Base-card clipping must never hide locked pieces. Player-base crowns are intentionally omitted because they can overlap the board at short heights. Every token, including home-stretch and locked pieces, remains circular at all supported viewport sizes and browser zoom levels.
- Piece skin selected in lobby must be carried through `playerSkins` into game state and rendered on board pieces.
- Selecting a legal piece opens `MoveSelector`; illegal/auto-controlled pieces must not become clickable.
- Victory opens `VictoryScreen` above the board and blocks gameplay.

### DiceTray

DiceTray must always retain active-player identity, dice, turn timer, roll control, and queue.

- Dice faces are `[1, 3, 4, 6]`; do not substitute standard six-sided dice.
- Roll is enabled only for an eligible human-controlled local turn. Bot/AFK-controlled turns auto-roll where appropriate.
- Mobile shows active player, YOU badge when applicable, selectable base pieces for valid spawning, one tappable Current Dice panel, and a horizontally scrollable queue with count. The roll instruction is inside the dice panel; do not add a separate Tap Dice to Roll action bar. The panel shows the decreasing turn-time outline/indicator and two compact square ornate dice cards.
- Full desktop shows `Active · Player Name` at the top of the sidebar, followed by a gold line/crown divider. The player name uses the seat colour and remains outside the dice control.
- The desktop roll control is one large rounded timer frame containing an inner gold-bordered panel, a `Current Dice` heading, two separate ornate square dice cards, and `Tap Dice to Roll` at the bottom. The dice cards and numerals scale from viewport height, using a smaller minimum on short/zoomed desktop screens so the action label never collides with Queue. The whole frame remains the accessible roll button; do not reintroduce a separate gold action bar on desktop.
- The desktop queue is a separate lower section with gold divider lines, a centred Queue heading, and one horizontal row of compact responsive roll chips. The desktop tray reserves 70% of its content height for active-player/dice controls and 30% (minimum 5.25rem) for Queue, with scrolling only as an extreme-height fallback. The first roll is gold; later rolls are dark. Long queues scroll horizontally instead of becoming a boxed vertical/wrapped panel.
- Compact landscape/tablet uses the mobile queue treatment, including its visible Queue label/count and horizontally scrollable entries. The tray receives 15rem of landscape height so the unchanged queue remains fully visible beneath the ornate dice area.
- Online AFK warning/progress is shown only when the active player has strikes; it changes appearance once bot takeover is active.
- Void-rule animation is a blocking body-level portal overlay only while a Void event is resolving. It stays above the in-game header at z-300, uses a viewport-capped internally scrollable card, and scales its GIF/spacing so the complete dialog remains reachable on short screens.
- No-valid-moves overlay appears only when the turn is genuinely stuck and is skipping.

### Movement and first-game help

`MoveSelector` is a blocking dialog only after a selected piece and active roll exist. It must offer only actions supported by the current roll/state: full move, high/low split, Spawn, Dual Spawn Attack, Pair Attack, next roll and Cancel as applicable.

The **Quick Tip** appears only for a first eligible game (`dyut_has_seen_in_game_how_to_play` is not set), never after game over or while a game information overlay is open. It changes copy for watch, roll, spawn, move and no-move states. It must stay dismissible through both Close and Got it, and must reserve space above the mobile tray.

### Victory

Victory is a full-screen portal overlay. It retains winner/champion information, Home action, New Game action, and public-match settlement (pool, fee, payout and team split) only for public matches. It must block the board beneath it.

## Functionality that must survive UI work

- Local games persist/resume through local storage and CrazyGames Data where appropriate.
- Auth is anonymous by default for standalone and CrazyGames user identity in portal builds.
- Online public/private rooms synchronize through RTDB, keep reconnect information, heartbeat/host migration and automatic bot handling.
- Game statistics, reward-goal progress, daily reward, purchases and match settlement update through `EconomyProvider`/services rather than direct UI-only state.
- Public matches reserve entry coins, refund failed starts, and settle prize/fee only once.
- Audio mute preference follows user preference and CrazyGames platform mute state.
- Ads are gated by `VITE_CG_ENABLE_ADS`; they must never be required to collect the base daily/goal reward.
- Translation keys must be preserved for English, Hindi and Marathi; do not replace translated text with hard-coded English UI.

## Responsive and QA contract

### Mandatory redesign viewport gate

Before designing or implementing any layout change, an AI agent **must keep every viewport in the following matrix in mind**. The redesign must preserve all required controls and functionality at every size; passing a single desktop screenshot is not sufficient. Design at `devicePixelRatio: 1`.

| CrazyGames context | Required dimensions |
| --- | --- |
| Desktop, non-fullscreen iframe | 907×510, 1216×684, 1077×606, 821×462 |
| Desktop, fullscreen | 1366×768, 1920×1080, 1536×864, 1280×720 |
| Mobile | 800×450 |
| Tablet | 1080×607 |

These are the current CrazyGames-required visual test sizes. Treat 821×462, 800×450, and 907×510 as critical compact-landscape breakpoints: header actions, board, DiceTray, queue, dialogs, and lobby actions must fit without overlap, clipping, or inaccessible content.

In addition to the CrazyGames sizes, retain the repository’s portrait regression coverage: 768×1024, 430×932, 390×844 and 360×800. If a redesign introduces a breakpoint, it must not displace the documented header items; relocate items only through the explicit responsive behaviour recorded above.

For every changed UI flow, verify the complete matrix above and confirm:

- No document/body horizontal or vertical overflow outside intentionally scrollable panels.
- Header controls are visible or deliberately relocated as documented.
- Rewards, Collection and the last Collection design are reachable.
- A short Collection keeps Close reachable after scrolling.
- Board, DiceTray, queue, timer and active-player bases do not overlap.
- Waiting lobby retains Leave Lobby.
- Tutorial is skippable and does not make roll/move controls inaccessible.
- Victory covers the viewport and prevents board interaction.

Run at minimum:

```powershell
npm.cmd run lint
npm.cmd test -- --run UnifiedLobby.test.jsx EconomyContext.test.jsx economy.test.js Board.test.jsx DiceTray.test.jsx
npm.cmd run build:crazygames
```

Use the automated capture scripts in `package.json` when the environment supports Chrome. Do not interpret a non-scrollable viewport as a reason to remove content; use an accessible internal scroll region where the documented UI requires it.

## Change checklist for AI agents

Before editing:

1. Read this document and `LogicAndRules.md` if gameplay is affected.
2. Name the exact user requirement and the exact listed item(s) it authorizes changing.
3. Identify standalone, portal, online and responsive branches affected, then design against the full CrazyGames viewport matrix before writing CSS or moving controls.

Before handoff:

1. Confirm no listed feature was removed, renamed, hidden, or relocated unintentionally.
2. Confirm state/persistence/economy changes still reach their existing UI feedback.
3. Run the relevant tests and responsive checks.
4. Update this document when the user-approved product contract changed.
