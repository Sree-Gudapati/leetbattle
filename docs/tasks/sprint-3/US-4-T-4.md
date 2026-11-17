---
id: US-4-T-4
story: US-4
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# Scoreboard UI

## Description
Serves US-4 (Team Score, #42). The match screen gets a scoreboard strip under the top bar with both team scores, the match timer and the most recent submissions. Issue #58.

## Specs
- The scoreboard shows "Team 1" and "Team 2" with their scores. Team 1's score uses the primary colour and Team 2's the secondary colour.
- The match timer is labelled "Time left", shown as MM:SS (754 seconds is "12:34", 65 seconds is "01:05", none left is "00:00"), and counts down every second.
- Recent submissions show the player who submitted, the question as "Question N", and either "Accepted" with its points (e.g. "+50") or "Wrong answer".
- Only the five most recent submissions are shown. With none, the scoreboard shows "No submissions yet".
- UI only for now: the scores, timer and submissions are sample data. Live data comes from GameService (#57, #70, #90).

## Requirements
- The match data lives in `frontend/app/editor/match-context.tsx` (`MatchProvider` / `useMatch()`), the strip in `frontend/app/editor/components/scoreboard.tsx`, which reads only `useMatch()`, and `frontend/app/editor/page.tsx` renders it inside `MatchProvider`.
- `match-context.tsx` is the one place to change when GameService pushes live scores and the timer.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/scoreboard.test.tsx`) use mocked match data and do not touch backend services.

## Acceptance criteria
1. Both team scores are shown, in the primary and secondary colours.
2. The match timer is shown as MM:SS and counts down.
3. Up to the five most recent submissions are shown, each with the player, the question and its result.
4. "No submissions yet" is shown when there are no submissions.
5. The match screen shows the scoreboard.
