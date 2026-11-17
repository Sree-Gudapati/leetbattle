---
id: US-6-T-2
story: US-6
sprint: 3
assignee: Joshua Sojan
estimate_hours: 1 - 2 
---

# Connect GameService and add WebSockets

## Description
Same as title, these need to be done

## Specs
- The same game UI needs to be implemented from practice but as a collaborative env
- Once all 6 players in a lobby ready up, the game begins and each team gets their own editor to work on collaboratively
- If a player disconnects, the game continues as normal (allow users to reconnect back to websocket), but of a whole team disconnects the other team automatically wins
- Add a forfeit button that requires all teammates to submit the forfeit. Once all 3 submit, the other team auto wins
- Users on the same team cannot concurrently submit tests, but a cooldown is given after a user submits to prevent spamming the GCP cloud functions
- End screen should occur (for now when all problems are solved, points system will be added later)


## Requirements
- Call the GameService container when the lobby has all readied up
- Create a new GameService Socket once the game starts and switch players to that socket
- Create a victory screen once one team finishes all the problems
- Handle disconnections in the way stated above
- Add forfeit button to the left of the options button in the AppBar
- Define a set of colors of each player of a team (randomly chosen at the start of the match)
    - If more than one user's carets are in the monaco editor, color the caret with their color and show their username above the caret
    - Add a TopBar Avatar stack, users dont have PFPs so make a circle with the first character in each of each spaced word in their username

## Acceptance criteria
## 1. Start the game when all players are ready

- **Given** a lobby with at least one player, **when** every player's status is "ready", **then** the lobby backend calls the GameService container to create a game.
- The call includes the lobby ID, the team assignments, and the problem set (or the information needed to select one).
- The call happens exactly once per game, even if multiple ready events arrive close together.
- **When** any player unreadies before the call is made, **then** the call is not made.
- **When** the GameService call fails or times out, **then** players stay in the lobby, an error is shown, and ready states are reset *(confirm)*.
- A minimum player count and a team-balance rule are enforced before the call *(confirm values)*.

## 2. Create a GameService socket and switch players to it

- **When** GameService confirms the game is created, **then** a new game socket is opened for that game and its connection details are returned to the lobby service.
- Every player in the lobby is sent the game connection info and connects to the game socket.
- Each player's identity is authenticated on the game socket, and players cannot join a game they weren't in the lobby for.
- Once a player's game socket connection is confirmed, they are disconnected from the lobby socket.
- The game starts only after all players have connected, or after a timeout (*confirm* the length), after which absent players are treated as disconnected.
- Players see a loading or transition state during the switch, and no lobby UI is visible once the game screen appears.

## 3. Victory screen

- **Given** a game in progress, **when** one team has completed all problems, **then** GameService ends the game and broadcasts a result to all players.
- Every player, on both the winning and losing teams, sees the victory screen.
- The screen shows the winning team, and may show per-team progress or completion time *(confirm)*.
- Problem submissions are rejected after the game has ended, so a second team finishing afterward cannot change the result.
- If two teams finish at the same time, the server's recorded order decides the winner.
- The victory screen has a way to return to the lobby or main menu, and the game socket is closed cleanly once players leave.
- When the game ends, the shared editor documents are made read-only or destroyed, and no further edits are accepted.

## 4. Disconnection handling

### Lobby

- **When** a player disconnects from the lobby socket, **then** they are removed from the lobby (or marked offline) and other players see the change within a few seconds.
- A disconnected player no longer counts toward "all ready". If the remaining players are all ready, the game-start rule is re-evaluated.

### Handoff

- **When** a player disconnects after receiving game connection info but before joining the game socket, **then** they are treated as disconnected from the game once the join timeout expires.

### In game

- **When** a player drops from the game socket, **then** the other players are notified, and the player has a reconnect window to rejoin (*confirm* the length).
- **When** the player reconnects within the window, **then** they resume with their team's current progress and their assigned color intact.
- **When** a reconnecting player's editor reconnects to the shared document, **then** it syncs to the current team document state without losing or duplicating text.
- **When** the window expires, **then** the player is marked as having left. If their team has no remaining players, that team forfeits and the other team wins.
- **When** all players disconnect, **then** the game is ended and cleaned up, and the GameService socket and shared documents are closed.
- **When** a player disconnects, **then** their remote caret is removed from the editor for other players, and their avatar is removed from the avatar stack or shown as offline *(confirm)*.
- **When** the editor connection drops but the game connection stays up (or the reverse), **then** the player sees a "reconnecting" indicator and edits made offline merge on reconnect *(confirm whether offline edits are supported)*.

## 5. Forfeit button

- A "Forfeit" button appears in the AppBar, immediately to the left of the Options button, and is visible only during a game.
- **When** a player clicks it, **then** a confirmation dialog appears, and nothing happens if they cancel.
- **When** they confirm, **then** the forfeit event is sent to GameService, and the game ends with the opposing team as winner (or applies the individual-leave rule if forfeit is per-player *(confirm)*).
- All players then see the victory screen, with the result marked as a forfeit.
- The button is disabled after the game ends or a forfeit has been sent, so it cannot be double-submitted.
- The button is keyboard-accessible and has an accessible label.

## 6. Collaborative team editor (Yjs + y-monaco)

**Background:** Monaco has no built-in multi-user editing, so teammates cannot currently edit the same code together. This section covers evaluating and adopting Yjs with y-monaco to provide shared editing, cursors, and selections.

### Spike

- A time-boxed spike *(confirm duration, e.g. 1–2 days)* proves that two browser clients can edit the same Monaco editor through Yjs + y-monaco, with live text sync and remote cursors.
- The spike confirms compatibility with the project's Monaco version and framework (e.g. React wrapper) and notes any issues.
- The spike evaluates which transport and provider to use (e.g. y-websocket, or a custom provider over the GameService socket) and records the decision *(confirm)*.
- The spike's outcome is documented. If Yjs + y-monaco does not meet the criteria below, a fallback is proposed (e.g. server-authoritative operational transform, or one editor per player) before implementation continues.

### Shared document

- Each team has its own shared editing document, backed by a Yjs document, for each problem the team works on *(confirm: per team per problem, or one per team)*.
- **When** a team member edits the code, **then** the change appears in teammates' editors in real time, with no manual refresh.
- **When** two teammates edit at the same time, **then** both edits are preserved and every client converges to the same text (no lost or duplicated edits).
- Players on one team cannot read or edit the other team's document. This is enforced on the server, not only hidden in the UI.
- Only authenticated players assigned to that team can connect to its document.
- A player who joins mid-game, or reconnects, receives the full current document state.
- Undo and redo affect only the local user's own changes *(confirm)*.
- The document's current text is available server-side so GameService can run and validate submissions against it.
- Yjs documents are created at game start and cleaned up at game end, with no state left behind between matches.
- Text sync keeps typing responsive for the target team size *(confirm target latency and max team size)*.

### Presence (awareness)

- Each player's presence (username, assigned color, cursor and selection) is shared through Yjs awareness.
- A player's presence is removed when they disconnect, within a few seconds.
- Presence uses the server-assigned player color, so the color a player sees for a teammate matches the avatar stack.

## 7. Player colors, editor carets, and avatar stack

### Color assignment

- **When** the match starts, **then** each player on a team is randomly assigned a color from a defined palette.
- Within a team, no two players share a color. The palette has at least as many colors as the maximum team size *(confirm max team size)*.
- Colors are assigned once, server-side, so every client sees the same color for the same player.
- A player's color stays the same for the whole match, including after a reconnect.
- Colors are not reassigned during the match when a player leaves.
- Palette colors meet a minimum contrast ratio against the editor background *(confirm theme and ratio)*.
- Whether colors may repeat across opposing teams is decided *(confirm)*.

### Monaco editor carets

- **Given** two or more users have carets in the same Monaco editor, **when** a remote user's caret is shown, **then** it is drawn in that user's assigned color.
- Remote carets and selections are rendered through y-monaco's awareness support, with styles (caret color, selection highlight, label) generated per player from their assigned color.
- The remote user's username is displayed above their caret.
- The username label uses the same color as the caret (or a readable label with a matching accent) and stays legible against the editor background.
- Remote carets and labels move in real time as the remote user moves their cursor or types.
- A remote caret near the top edge of the editor keeps its username label visible instead of being clipped *(confirm)*.
- The local user's own caret keeps the default Monaco style and gets no username label.
- Carets only appear for teammates sharing the same document. Opposing-team carets are never sent or shown.
- When a user is the only one in the editor, no username label is shown.
- Usernames are rendered as text and never injected as raw HTML or unescaped CSS, so a malicious username cannot break styling or run script.

### TopBar avatar stack

- An avatar stack appears in the TopBar, showing the players in the game *(confirm: own team only, or all players)*.
- Users have no profile pictures, so each avatar is a circle filled with the player's assigned color, containing initials.
- Initials are the first character of each space-separated word in the username, in uppercase. "Ada Lovelace" shows "AL", and "grace" shows "G".
- Extra spaces (leading, trailing, or repeated) are ignored, and an empty username shows a fallback character such as "?" *(confirm)*.
- Initials are capped at a maximum length so they fit the circle *(confirm cap, e.g. 2 or 3)*.
- Avatar text meets a minimum contrast ratio against the avatar color.
- Avatars overlap in the stack in a consistent order. When there are more avatars than fit, the stack shows a "+N" overflow indicator *(confirm threshold)*.
- Each avatar has an accessible label and a tooltip showing the full username.
- The stack updates when a player joins, leaves, or disconnects.

## 8. Frontend tests

### General

- The lobby socket is mocked in all tests, and no test opens a real network connection or calls a backend service.
- Yjs providers (e.g. y-websocket) are mocked or replaced with in-memory providers, so no test connects to a real collaboration server.
- Tests run in CI with no backend running, and they pass reliably across repeated runs.

### Ready/unready controls

- The Ready button renders in the lobby, and clicking it emits the ready event on the mocked socket.
- After a player is ready, the control changes to "Unready", and clicking it emits the unready event.
- Controls are disabled when the socket is disconnected or the game is starting.

### Displayed player status

- Each player in the lobby is rendered with their name and a ready or not-ready indicator.
- Incoming mock socket events (ready, unready, join, leave) update the displayed statuses.
- The current player's own status is shown correctly, and a player who leaves is removed from the list.
- An empty lobby and a lobby with all players ready each render correctly.

### Avatar stack and carets

- An initials helper is unit-tested for single-word, multi-word, extra-space, lowercase, and empty usernames.
- The avatar stack renders one avatar per player, each with the correct initials and background color.
- The overflow indicator appears when there are more avatars than fit.
- Given mocked awareness data, remote carets are rendered with the player's color and username label, and the local caret is not labeled. The Monaco editor is mocked or stubbed in these tests.
- A username containing HTML or CSS characters is rendered as plain text.