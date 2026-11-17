---
id: US-2-T-2
story: US-2
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 8
---

# Send code changes to teammates in real time

## Description
Serves US-2 (Collaboration, #40). During a match, each player's code is passed on to their teammates as they write it, and never to the other team. Each player keeps their own editor (the #50 decision: read-only for this sprint), so teammates only receive the code to view it (#47). Issue #48.

## Specs
- A player sends their whole editor for one question (its tabs and which tab is open) on the `game:code` socket event, debounced by the editor so it isn't sent on every keystroke. This answers the open question on #48: full contents, not diffs.
- GameService passes it on to the player's own team room only, with the player's userId and display name, the question id and the editor. The other team never receives it, and the sender doesn't get it back.
- Code is only passed on while the game is playing, for a question in the match pool, and when the editor is well-formed. Anything else is dropped.
- Nothing is saved: keeping the latest code for players who refresh or reconnect is #49.
- Live co-editing (collaborative Monaco, shared cursors) is out of scope.

## Requirements
- The relay lives in `service/GameService/src/server.ts`, using the team rooms players already join on connect.
- The team restriction is enforced on the server, not in the UI.
- GameService tests (`service/GameService/test/socket.test.ts`) use real sockets against a fake CodeService.

## Acceptance criteria
1. A teammate receives a player's code with their userId, the question id and the editor.
2. The other team never receives it, enforced on the server.
3. The sender doesn't receive their own code back.
4. Code sent before play starts, for a question outside the pool, or with a malformed editor is not passed on.
5. The full contents vs. diffs question is answered: debounced full contents.
