---
id: US-5-T-8
story: US-5
sprint: 2
assignee: Sashreek Rewatkar
estimate_hours: 3 - 4
---

# Scroll home screen

## Description
Serves US-5 (UI/UX). The first signed-in home screen: a scrolling menu list over a falling code background. The scroll wheel was later replaced by the title-screen menu (US-5-T-6). Issue #82, finished in PR #36.

## Specs
- A signed-in player sees a home screen instead of the landing page.
- The home screen shows a scrolling menu list of the pages the player can open, and a practice card.
- Code snippets fall behind the menu.

## Requirements
- Home components live under `frontend/app/_home/components`.
- The falling code is hidden from screen readers.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/home.test.tsx`, `frontend/test/page.test.tsx`) mock the signed-in user and do not touch backend services.

## Acceptance criteria
1. A signed-in player sees the home menu.
2. A signed-out visitor sees the landing page.
3. Each menu option opens its page.
4. The falling code background is hidden from screen readers.
