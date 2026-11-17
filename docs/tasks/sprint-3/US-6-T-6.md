---
id: US-6-T-6
story: US-6
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 4
---

# Practice editor in the match after the bans

## Description
Serves US-6 (In-Game, #67). Once the bans are in, the game page shows the practice editor (question panel, code tabs, Monaco, Run / Submit, results, test cases) with the problems left in play, so players can actually play the match. Issue #110.

## Specs
- While the game is playing, the game page shows the editor under the rosters. It isn't shown while waiting for players or during the bans.
- The editor has one question tab per problem left after the bans, each loaded from CodeService by its question_id, in pool order.
- Submit goes through the game (`game:submit`), so an accepted answer counts for the team. The grading shows in the results panel, and a refusal shows a readable message there (cooldown, a teammate's submission still being graded, match not running, question not in the match, grading failed).
- Run works like practice, straight against CodeService.
- Each player has their own editor. Their code is sent only through the game (`game:code`, debounced 500 ms), which passes it on to their own team (US-2-T-2, #48). The editor never opens a lobby socket in a match, so code never reaches the other team.
- No collaborative Monaco or live co-editing: that is a future PR.
- The practice editor at `/editor` keeps working as before.

## Requirements
- The editor layout is shared by both pages in `frontend/app/editor/components/editor-layout.tsx`.
- `EditorProvider` (`frontend/app/editor/context.tsx`) takes the match's question ids, a submit function and a share-code function; practice passes none of them.
- The game socket (`frontend/app/game/socket-context.tsx`) provides `submit` and `shareCode`; the game page is `frontend/app/game/[gameId]/page.tsx`.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/game.test.tsx`, `game-socket.test.tsx`, `editor.test.tsx`) mock the game socket, Monaco and CodeService, and do not touch backend services.

## Acceptance criteria
1. After the bans, the game page shows the practice editor with the problems left in play.
2. Submitting goes through the game and shows the grading, or a readable message when refused.
3. Run works like practice.
4. A player's code only goes to their own team, never through the lobby socket.
5. The practice editor at `/editor` still loads random practice problems.
