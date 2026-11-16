---
id: US-5-T-4
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# Interactive home background

## Description
Serves US-5 (UI/UX). The code snippets falling behind the home menu react to the cursor, and the 01/02/03 labels are removed from the menu. Issue #78, finished in PR #64.

## Specs
- A snippet near the cursor is pushed away from it. A fast swipe pushes harder than a slow hover.
- A pushed snippet slows down and stays where it lands; it does not snap back.
- A snippet far from the cursor does not move.
- The background does not react to the cursor when reduced motion is on.
- The home menu no longer shows the 01, 02, 03 option numbers.

## Requirements
- The behaviour lives in `frontend/app/_home/components/code-rain.tsx`.
- The background stays hidden from screen readers.
- No new dependencies.
- Frontend tests (`frontend/test/cursor.test.tsx`) do not touch backend services.

## Acceptance criteria
1. A snippet near the cursor is pushed away from it.
2. A pushed snippet stays where it was pushed.
3. A snippet far from the cursor stays where it is.
4. Snippets do not react to the cursor when reduced motion is on.
5. The home menu does not show option numbers.
