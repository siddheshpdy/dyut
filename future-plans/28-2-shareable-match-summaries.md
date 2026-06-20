# Phase 28.2: Shareable Match Summaries Plan

## Objective

Let players create and share a visual match summary after victory.

## Why This Matters

Shareable summaries provide organic promotion and give wins a satisfying artifact without affecting gameplay.

## Current Touchpoints

- `VictoryScreen.jsx`: post-match actions
- `Board.jsx`: final board visual state
- `GameContext.jsx`: winner and match state
- Browser Web Share API

## Data Needed

Match summary fields:

- winner name
- match type
- player colors/names
- duration
- captures
- pieces finished
- final board state thumbnail
- date

## Implementation Steps

1. Define a `MatchSummary` object at game end.
   Why: sharing needs a stable data shape independent of UI rendering.

2. Add optional match stats tracking.
   Why: richer summaries need duration, captures, and turn counts.

3. Add a hidden `MatchSummaryCard.jsx` render target.
   Why: `html2canvas` needs a DOM node with predictable dimensions and styles.

4. Add `html2canvas`.
   Why: it can convert the summary card into an image blob for sharing.

5. Add Share Win button to `VictoryScreen.jsx`.
   Why: victory is the natural moment to share.

6. Use `navigator.share` when available and download fallback otherwise.
   Why: desktop browsers may not support file sharing.

7. Add portal-specific behavior.
   Why: iframe restrictions may limit Web Share API access on portals.

## Security and Privacy Notes

- Do not include uid, email, or invite links in shared images.
- Let players share display names only.
- Avoid uploading images to a server unless explicitly needed later.

## Tests

- Component test summary card renders expected fields.
- Unit test summary data builder.
- Manual mobile test Web Share API.
- Manual desktop test download fallback.
- Visual regression snapshot for summary card if tooling is added.

## Rollout Plan

1. Add summary card and local download fallback.
2. Add Web Share API support.
3. Add richer match stats once progression/quests track stats.

## Dependencies

- Benefits from progression match stats.
- Does not require backend for first version.
