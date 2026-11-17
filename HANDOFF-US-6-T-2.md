# Handoff: US-6-T-2 (GameService + websockets)

Branch: `gameService-creation`. Spec: `docs/tasks/sprint-3/US-6-T-2.md` (don't edit `docs/`: ask first).
Last updated 2026-11-16.

## Rules that still apply (from AGENTS.md)
- TDD: pseudocode tests first (the user has OK'd Claude writing them, in the style of the existing `*-pseudo.md` files), convert them to commented tests with **one expect each**, watch them fail, then write the minimum code.
- Ask before any git push/PR or GCP work. Don't change lint rules. Keep `jscpd` clean.

## Decisions already made (don't re-ask)
| Topic | Decision |
|---|---|
| Team size | Lobby host (earliest member still in the lobby) picks 1v1/2v2/3v3. When it shrinks, random players are moved to no team; if the lobby is still over capacity, random non-host players are removed |
| Forfeit | Every *connected* teammate must vote, then the other team wins |
| Reconnect window | 30 s, then the player counts as left. A team where everyone has left loses |
| Join wait | 5 s after creation, then the clock starts with whoever connected |
| Lobby after a match | Resets right away: the match players' seats are released, observers stay connected |
| Yjs docs | One per Monaco tab if the match editor has tabs, otherwise one per team per problem |
| Yjs transport | GameService socket team room first; switch to y-websocket only if that causes problems |
| Avatar stack | Own team only |
| Colours | Random per team, unique within a team, repeats across teams OK (palette of 3) |

## Protocol (as built)
- **LobbyService (4003):** countdown ends → `lobby:ready-for-match { lobbyId, players }` → `PUT /game { players }` on GameService → `lobby:game-started { gameId }` → the players' lobby sockets are closed and their seats released. On failure: ready states reset, then `lobby:error { code: 'game-start-failed' }`.
- **GameService (4004), Express + socket.io on one port.** Handshake auth is `{ token, gameId }`; it rejects with `unauthorized` or `not-in-game`. Rooms are `game:<id>` and `game:<id>:<team>` (the server assigns the team).
  - `game:state { gameId, phase: 'waiting'|'playing', startedAt, secondsRemaining, scores, problemPool (task_ids), players[{userId, displayName, team, connected, left}], forfeitVotes {a, b} }`, sent on every change.
  - Client → `game:forfeit`. Server → `game:ended { winner: 'a'|'b'|null, reason: 'forfeit'|'disconnect'|'time' }`, then sockets are closed and the game is forgotten. `ended_at` and scores are saved to Postgres *before* `game:ended` is sent.
  - `PUT /game` fetches problems from CodeService first (502 if it fails), then saves everything in one SQL statement (`SAVE_GAME_SQL`), so there are no half-made games.

## Status
Committed (through `74f7814`): handoff, team size, CodeService error handling + atomic save, merges of `Task/US-1-T-3` and `origin/main`.

**Done but uncommitted: match lifecycle slice.** All checks pass. Commit it once the user OKs.
- LobbyService: reset after match start. 38/38 tests pass.
- GameService: join wait, reconnect window, team-wipe win, forfeit vote, `endGame`, timer cleanup in `close()`. 42/42 tests pass, coverage OK (branches 80.45%, right at the threshold).
- Frontend: `game:ended`/`forfeit()` in `app/game/socket-context.tsx`, an `actions` slot on `HomeTopBar` (Forfeit sits left of the account menu), Forfeit button + confirm dialog, a waiting state, and the result screen in `app/game/[gameId]/page.tsx`. 255/255 tests pass.
- Not covered yet: the "time ran out" end (`endOnTime`) has no test, because the 20-minute clock isn't configurable in tests.

## Remaining work, in order
1. **Commit the lifecycle slice** (above).
2. **Problem details on the game page.** `game:state` sends only task_ids, and CodeService looks problems up by `question_id` (`GET /problem/:questionId`). Either carry `question_id` in the pool or add a task_id lookup.
3. **Victory when a team solves every problem, plus scoring.** Implement `recordSubmission`/`selectProblem` (stubs in `service/GameService/src/service.ts`). Reject submissions after the game ends. A per-team submit lock plus cooldown (spec bullet) protects the GCP functions.
4. **Yjs spike:** check y-monaco against `@monaco-editor/react` 4.7 / monaco 0.57, sending updates over the GameService team room. Record the result.
5. **Shared editor:** docs per the decision above, a server-side copy of the text for submissions, cleanup when the game ends.
6. **Colours, remote carets with username labels (render as text, never HTML), and the TopBar avatar stack** (initials helper, overflow `+N`), with Yjs awareness using the server-assigned colour.

## Known issues / gotchas
- **No git fetch from Claude's shell:** the SSH key isn't available (`Permission denied (publickey)`). Have the user run `git fetch origin`.
- **Local DB:** the Docker volume predates GameService, so `game_service` was created by hand from `service/GameService/sql/*.sql`. If the volume is reset, the init scripts handle it.
- **Fake problems:** the local `code_service` DB had only 3 Easy problems, so 3 Easy + 3 Medium were inserted by hand (real task_ids, and the dataset import upserts over them). The SQL is in the old session scratchpad, not the repo. A match needs at least 6 Easy and 3 Medium problems.
- **Flaky frontend tests:** the full frontend suite times out randomly while the dev servers are running. Use `--maxWorkers=2`. An editor test ("shows the second case when its tab is clicked") flakes occasionally and passes on its own.
- **LobbyService coverage:** it has no `@vitest/coverage-v8`, so run `npx vitest run` without `--coverage`.
- **GameService socket tests** use a 300 ms join wait and reconnect window (`test/setup.ts`), and every test makes a fresh game. Don't share a game across tests: an absent team gets marked as left and the game ends.
- **Main's teammate tabs** (`editor:workspace:update` over the lobby socket) aren't relayed by any server. Unrelated to this task, but it overlaps with step 5.
- **In-memory games:** if GameService restarts mid-match, the game is lost and players get `not-in-game`.
- **Ownership:** tyler-ham05 built an overlapping handoff in parallel. Agree on who owns which part of US-6-T-2 before starting the next slice.

## Key files
- `service/LobbyService/src/server.ts` (`startGame`), `src/lobby-state.ts` (`setTeamSize`, `removePlayers`, host)
- `service/GameService/src/server.ts` (socket lifecycle), `src/service.ts` (REST, `GameState`, `SAVE_GAME_SQL`), `src/auth.ts`
- `frontend/app/lobby/{page,socket-context}.tsx`, `frontend/app/game/{socket-context.tsx,[gameId]/page.tsx}`, `frontend/app/_home/components/topbar.tsx`
- Pseudocode: `service/LobbyService/test/{game-start,team-size}-pseudo.md`, `service/GameService/test/socket-test-pseudo.md`, `frontend/test/{game,lobby}-test-pseudo.md`
