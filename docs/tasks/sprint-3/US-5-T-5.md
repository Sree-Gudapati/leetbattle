---
id: US-5-T-5
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 1
---

# Keep the frontend CI check green

## Description
Serves US-5 (UI/UX). The frontend check requires 80% coverage for lines, statements, functions and branches (`frontend/vitest.config.ts`). Branch coverage dropped under 80% once the lobby page was counted. This task brought it back to about 83%. Issue #79, finished in PR #63.

## Specs
- The loader and navigation tests no longer load the lobby page; the lobby page is covered by its own tests.
- The tests for the cursor behaviour of the home background are added (`frontend/test/cursor.test.tsx`).

## Requirements
- Do not lower the coverage thresholds.
- Do not change linting rules.
- Test changes only; no change to how the app behaves.

## Acceptance criteria
1. Branch coverage for the frontend is at or above 80%.
2. The frontend check passes on main.
