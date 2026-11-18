---
id: US-6-T-8
story: US-6
sprint: 3
assignee: Ashwin Vinod
estimate_hours: 4
---

# Add a Rejoin Match button

## Description
Serves US-6, the In-Game story (#67). A player who disconnects from an active match can get back to it with a Rejoin Match button, without needing to know the game URL. This task covers looking up the player's own active match, showing the button on authenticated pages, and reconnecting through the existing game screen.

Out of scope: how long a seat is held and what happens to a short-handed team (GameService's reconnect window), changes to the game screen itself, and rejoining from the lobby countdown.

## Specs
- `GET /game/:id` (GameService, `service/GameService/src/service.ts` `getGame`) requires the login token in an `Authorization: Bearer <token>` header.
  - Missing or invalid token: HTTP 401.
  - `:id` is not the token's user: HTTP 403, and no match information is returned.
  - The player has an active match: HTTP 200 with `{ "gameId": "<id>", "socketUrl": "<GameService WebSocket URL>", "gameRoute": "/game/<id>" }`.
  - The player has no active match: HTTP 404 (unchanged).
  - Existing callers and tests of `GET /game/:id` are updated to send the token and read the new response.
- A rejoin check component in the root layout (`frontend/app/layout.tsx`, inside `AuthProvider`) calls `GET /game/:id` for the signed-in user:
  - on initial load and after every route change;
  - asynchronously, so navigation never waits for the request;
  - not at all when no user is signed in, or while the player is on a `/game/*` route.
- A **Rejoin Match** button appears in the shared navigation whenever the latest check found an active match. It is hidden when the check returns 404 or an error, and when no user is signed in.
- Clicking **Rejoin Match** navigates to the returned `gameRoute`. The existing game screen (`frontend/app/game/[gameId]/page.tsx`) then reconnects through its WebSocket flow (`frontend/app/game/socket-context.tsx`) and shows the current `game:state`.
- If the match ended between the check and the click, the game socket's connection is rejected with `not-in-game`. The app shows "This match is no longer available." and the Rejoin Match button is cleared.

## Requirements
- Only return match information for the authenticated player's own active match. The user comes from the login token, never from the request alone.
- Reuse GameService's existing `authenticateToken` (`service/GameService/src/auth.ts`). No new runtime dependencies.
- Reuse the existing game screen and game socket flow. Do not add a second game route or socket client.
- Frontend tests use mocked API and WebSocket responses and never call a real backend service.
- Existing GameService and frontend tests keep passing, apart from the `GET /game/:id` tests updated for the new auth and response.

## Acceptance criteria
1. `GET /game/:id` without a valid token returns 401.
2. `GET /game/:id` for a different user's id returns 403 with no match information.
3. `GET /game/:id` for the token's own user with an active match returns 200 with `gameId`, `socketUrl`, and `gameRoute`.
4. After disconnecting, a signed-in player who refreshes or moves to another authenticated page sees Rejoin Match while their match is active.
5. The rejoin check runs again after a route change without blocking navigation.
6. Clicking Rejoin Match opens `/game/<gameId>`, which reconnects to the same match and shows its current game state.
7. Rejoin Match is hidden when the player has no active match.
8. If the match has ended before the rejoin attempt, the app shows "This match is no longer available." and Rejoin Match is no longer shown.
