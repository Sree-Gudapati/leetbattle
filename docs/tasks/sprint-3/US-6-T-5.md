---
id: US-6-T-5
story: US-6
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 1
---

# Remove the question list from the game page

## Description
Serves US-6 (In-Game, #67). The game page listed the match's questions by name, with a description panel, in place of the editor. It showed all nine names while players were still connecting, before the ban screen that shows questions by topic only, and after the bans it was the only way to see a question. It is removed; the practice editor takes its place after the bans (US-6-T-6). Issue #107.

## Specs
- While the game is waiting for players, no question name is shown.
- While the game is playing, the "Problems" list is not shown.
- The ban screen, rosters, clock, score, forfeit and result screen are unchanged.

## Requirements
- The change is in `frontend/app/game/[gameId]/page.tsx`.
- Until US-6-T-6 lands, a match in play shows no questions.
- Frontend tests (`frontend/test/game.test.tsx`) mock the game socket and do not touch backend services.

## Acceptance criteria
1. No question name is shown on the game page before or during the bans.
2. The "Problems" list is gone from the game page.
