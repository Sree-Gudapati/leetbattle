---
id: US-5-T-3
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# Three-line menu and accessibility

## Description
Serves US-5 (UI/UX). The top bar gets a three-line (☰) menu that reaches every page, and the menu and home link work with a keyboard and a screen reader. Issue #77, finished in PR #62.

## Specs
- The menu button shows three lines and opens a list with Home, Practice, Lobby, Settings and Log out.
- The menu button has a screen reader label and tells screen readers whether the menu is open.
- Escape closes the menu. Clicking outside the menu closes it.
- The home link has a screen reader name, is the first thing the Tab key reaches, and shows an underline (not a box) when reached with the keyboard.

## Requirements
- The menu lives in `frontend/app/_home/components/user-menu.tsx` and is only shown to a signed-in user.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/navigation.test.tsx`) mock the signed-in user and do not touch backend services.

## Acceptance criteria
1. The menu button shows three lines.
2. The menu links to Home, Practice, Lobby and Settings.
3. Screen readers are told when the menu is open.
4. The menu closes when Escape is pressed.
5. The home link has a name for screen readers.
6. The home link is the first thing the Tab key reaches.
7. The home link shows an underline, not a box, when reached with the keyboard.
