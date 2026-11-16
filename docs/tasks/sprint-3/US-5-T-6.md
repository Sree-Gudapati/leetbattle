---
id: US-5-T-6
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 3 - 4
---

# Title-screen home menu

## Description
Serves US-5 (UI/UX). The signed-in home screen is replaced with a game title screen: the player's name, a big LeetBattle title and a stacked menu over the falling code. It replaces the scroll wheel picker. Issue #80, finished in PR #66.

## Specs
- The page shows "Player · <name>" (the email when the player has no name) and LeetBattle as the page heading.
- The menu lists Practice, Lobby and Settings, in that order, each with a one-line description, then Log out.
- Practice is selected when the page opens.
- Hovering a row or moving keyboard focus to it selects it.
- Arrow down and arrow up move to the next and previous row and wrap around.
- Enter opens the selected row when nothing is focused.
- Log out signs the player out and returns to the home page.
- Keyboard hints for selecting and opening are shown at the bottom.
- The home page shows the three-line menu in the corner instead of the top bar, and the falling code is larger and more visible.

## Requirements
- The menu lives in `frontend/app/_home/components/home-actions.tsx`.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/home.test.tsx`) mock the signed-in user and do not touch backend services.

## Acceptance criteria
1. LeetBattle is the page heading.
2. The name of the signed-in player is shown.
3. Practice, Lobby and Settings are shown in that order, each with a one-line description.
4. Practice is selected when the page opens.
5. A row is selected when it is hovered.
6. A row is selected when it gets keyboard focus.
7. Arrow down moves keyboard focus to the next row.
8. Arrow up from the first row wraps around to Log out.
9. Enter opens the selected row when nothing is focused.
10. Log out signs the player out.
11. Keyboard hints for selecting and opening are shown.
