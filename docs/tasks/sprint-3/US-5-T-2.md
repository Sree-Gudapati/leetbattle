---
id: US-5-T-2
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 1 - 2
---

# Navigation from every page

## Description
Serves US-5 (UI/UX). Practice, Settings and Sign in had no way back to the home page, so a player could get stuck on them. This task gives those pages the shared top bar. Issue #76, finished in PR #62.

## Specs
- Practice, Settings and Sign in show the shared top bar.
- The LeetBattle wordmark in the top bar links to the home page.

## Requirements
- Reuse the existing top bar and wordmark components; do not build a second one.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/navigation.test.tsx`) do not touch backend services.

## Acceptance criteria
1. Practice links to the home page.
2. Settings links to the home page.
3. Sign in links to the home page.
