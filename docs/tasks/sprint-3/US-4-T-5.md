---
id: US-4-T-5
story: US-4
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# End-of-match screen

## Description
Serves US-4 (Team Score, #42). A `/results` screen that shows who won the match and the final scores. Issue #59.

## Specs
- The headline is "Team 1 wins", "Team 2 wins" or "Draw", decided by the final scores.
- The signed-in player sees "Victory" if their team won and "Defeat" if it lost.
- Both final scores are shown. Team 1's score uses the primary colour and Team 2's the secondary colour.
- "Play again" links to the lobby and "Back to home" links to the home page.
- UI only for now: the final scores are sample data, and nothing navigates to `/results` yet. That needs the match-end event from GameService (#70, #90).

## Requirements
- The final scores live in `frontend/app/results/context.tsx` (`ResultsProvider` / `useResults()`), `frontend/app/results/layout.tsx` wraps the route in the provider, and `frontend/app/results/page.tsx` reads only the hook.
- `context.tsx` is the one place to change when the match-end event lands.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/results.test.tsx`) use mocked final scores and do not touch backend services.

## Acceptance criteria
1. The winner is shown, or "Draw" when the scores are level.
2. The signed-in player sees "Victory" or "Defeat" for their team.
3. Both final scores are shown, in the primary and secondary colours.
4. "Play again" goes to the lobby and "Back to home" goes to the home page.
