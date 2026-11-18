---
id: US-1-T-2
story: US-1
sprint: 3
assignee: Ashwin Vinod
estimate_hours: 2
---

# Sync each player's ready state across the lobby websocket

## Description
Serves US-1 (players ready up in the lobby before a match). This task makes LobbyService the single source of truth for each player's ready state, broadcasts every change to all players in the lobby, keeps a readied player's ready status when a team switch is rejected, and resets ready status when a player leaves. It applies to every lobby size the lobby supports (1v1, 2v2, 3v3). Lobby capacity is always twice the selected `teamSize`.

Out of scope: the ready/unready UI and the "all lobby seats filled" precondition (US-1-T-1), the match-start countdown, and team-size selection itself.

## Specs
- LobbyService (`service/LobbyService/src/lobby-state.ts`, `service/LobbyService/src/server.ts`) owns each player's `ready` flag. Clients change it only by emitting `lobby:set-ready` with a boolean. The server never trusts a ready value sent any other way.
- `lobby:set-ready` with a non-boolean value is rejected with `lobby:error` `{ code: "invalid-ready-status" }`, and no player's ready state changes.
- After every accepted ready change, the server emits `lobby:state` to the lobby room, and every connected client in the lobby receives it. That means 2 clients in a 1v1, 4 in a 2v2, and 6 in a 3v3. The changed player's entry in `players` has the new `ready` value, and `readyCount` matches.
- Once every player in a full lobby of the selected size is ready, `lobby:state` reports `readyToStart: true`.
- A readied player can only be in a full lobby, so a `lobby:join-team` for the other team is rejected with `lobby:error` `{ code: "team-full" }`, and the player stays `ready: true`.
- A readied player who emits `lobby:leave` is removed from the lobby. Every remaining player has `ready: false` in the next `lobby:state` broadcast, and `readyCount` is `0`.

## Requirements
- Use the existing `lobby:set-ready`, `lobby:join-team`, `lobby:leave`, and `lobby:state` socket events. Do not add new events or payload fields.
- Change existing LobbyService behaviour only where a test shows it differs from the Specs.
- No new runtime dependencies. Tests use the existing vitest and socket.io-client setup in `service/LobbyService/test`.
- Existing LobbyService tests must keep passing.

## Acceptance criteria
1. A ready change requested with a non-boolean value is rejected with `invalid-ready-status`, and the server-held ready state is unchanged.
2. When one player readies up, every connected client in the lobby receives a `lobby:state` broadcast showing that player as `ready: true`.
3. When one player un-readies, every connected client in the lobby receives a `lobby:state` broadcast showing that player as `ready: false`.
4. In a full lobby of the selected team size (1v1, 2v2, or 3v3), once every player is ready, `lobby:state` reports `readyToStart: true`.
5. A readied player who tries to switch teams in a full lobby receives a `team-full` error and stays `ready: true`.
6. After a readied player leaves the lobby, the next `lobby:state` broadcast shows every remaining player as `ready: false`.
