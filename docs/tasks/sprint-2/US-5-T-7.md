---
id: US-5-T-7
story: US-5
sprint: 2
assignee: Sashreek Rewatkar
estimate_hours: 4 - 5
---

# Landing page and theme system

## Description
Serves US-5 (UI/UX). The first page a signed-out visitor sees, and the color system every page shares. Issue #81, finished in PR #21 and PR #32.

## Specs
- The landing page opens with an intro that can be skipped.
- The landing page shows a live match demo: a solution is typed out line by line, test cases resolve and both teams' scores update.
- The whole site shares one color scheme and a light or dark mode, as described in docs/frontend/theming.md.
- The chosen scheme and mode are remembered between visits and applied before the page first paints.
- The Onest and JetBrains Mono fonts are bundled with the app.

## Requirements
- Colors are CSS variables in `frontend/app/globals.css`; pages use the theme classes and never raw Tailwind palette classes.
- The demo runs in the browser and does not call backend services.
- Frontend tests (`frontend/test/landing.test.tsx`) do not touch backend services.

## Acceptance criteria
1. The intro shows a Skip button.
2. The intro goes away immediately when Skip is clicked.
3. The live demo types out every line of the solution.
4. The live demo shows the resolved test-case tags.
5. Both scores stay at 0 before the match starts playing.
6. Each team's score is awarded as the demo plays.
7. The chosen color scheme and mode are still applied after a reload.
