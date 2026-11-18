---
id: US-3-T-2
story: US-3
sprint: 3
assignee: Sree Satya Jayanth Gudapati
estimate_hours: 4
---

# Send and recieve team chat messages over the GameService Websockets

## Description
Serves US-3 Communication. The team chat panel currently keeps messages only in the messaging persons browser and it only works in the practice page not on GameService over a websocket. This task sends each message over the match websocket so every teammate sees it and it saves to the GameService DB. Out of scope: loading history on join or reconnect, cross team chat, the chat panel's look (US-3-T-1), message moderation / profanity filtering. 

## Specs
### Sending
- A connected player sends 'chat:send' with '{ text }' over a socket on GameService
- Text over 500 characters in length will be rejected and an error message will be returned "Message too long" 
- Messages are rejected after the game has concluded
### Receiving
- The server sends out 'chat:message' to the sender's team room 'game:<id>:<team>' with {id, userId, displayName, team, text, sentAt}'. The sender recieves that information too.
- The other teams socket should not recieve this information at all. 
### Storage
- Each accepted message is saved into a new DB table called `team_messages` which will have columns: game_id, team, user_id, text, sent_at
### Frontend 
- The already existing `useTeamChat()` in `frontend/app/editor/chat-context.tsx` stays the same shape. 
- When a game socket is available, messages is filled from incoming `chat:message` events instead of the local state. Otherwise it keeps the local state. (This makes sure the tests from when chat was static and not set up over the websocket still pass)
- When `chat:send` is answered with "Message too long", the chat bar shows that message
- The match page shows the team chat panel while playing, connected to the game socket. 


## Requirements
- Use the existing GameService socket auth and team rooms implementation. 
- Each stored message has the id of the game it was sent in, and the sender's team and user id.
- If there are multiple games in progress at the same time, a chat message stays inside the game it was sent in.

## Acceptance criteria
1. A players `chat:send` is delivered as a `chat:message` to every connected teammate. 
2. The sender of `chat:send` recieves their own `chat:message` as well
3. Players from the opposing team do not recieve `chat:message` 
4. A `chat:send` message with text longer than 500 characters is rejected and is not saved to the `team_messages` db and no `chat:message` is sent. It will return "Message too long" 
5. When a message is rejected for the reason of being too long it will show the user "Message too long" in the chat bar. 
6. A valid message saves game_id, team, user_id, text and sent_at to the `team_messages` db. 
7. With two games in progress, a `chat:send` in one game is delivered only to the players of that game. No player in the other game should reccieve the `chat:message` resulting from that `chat:send`
8. In the frontend, calling `send` emits `chat:send`.
9. In the frontend an incoming `chat:message` appears in `messages` once. 
10. Messages are rejected after the game ends and are not saved to the DB and no `chat:message` is sent.