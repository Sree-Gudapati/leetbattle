---
id: US-5-T-1
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 3 - 4
---

# Page loading animations

## Description
Serves US-5 (UI/UX). Every page plays a short LeetBattle animation when it opens, so moving between pages feels like one game. Issue #75, finished in PR #62.

## Specs
- Home plays the katana slice: the LeetBattle wordmark is cut diagonally and the halves slide apart.
- Lobby plays the team clash: the Team 1 and Team 2 panels meet, VS drops in, then they pull back.
- Practice, Sign in and Settings play the type wipe: the wordmark is drawn in, then the cover lifts.
- The animation plays every time the page is opened or refreshed, and removes itself when it ends.
- The animation is skipped when the user has reduced motion turned on.

## Requirements
- One shared component, `frontend/app/_shared/page-loader.tsx`, with a variant per animation.
- The reduced motion check lives in `frontend/app/_shared/motion.ts`.
- The loader is hidden from screen readers and does not block clicks.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/loader.test.tsx`) do not touch backend services.

## Acceptance criteria
1. The loader shows the LeetBattle wordmark.
2. The loader is hidden from screen readers.
3. The loader goes away once its animation ends.
4. The loader does not show when reduced motion is on.
5. The loader plays again every time the page is opened.
6. Home plays the katana slice.
7. Practice, Settings and Sign in play the type wipe.
