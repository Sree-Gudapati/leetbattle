---
id: US-3-T-2
story: US-3
sprint: 3
assignee: Sree Satya Jayanth Gudapati
estimate_hours: 4
---

# Send and recieve team chat messages over the GameService Websockets

## Description
Serves US-3 Communication. The team chat panel currently keeps messages only in the messaging persons browser. This task sends each message over the match websocket so every teammate sees it and it saves to the GameService DB. Out of scope: loading history on join or reconnect, cross team chat, the chat panel's look (US-3-T-1), message moderation / profanity filtering. 

## Specs
### Sending
- A connected player emits 'chat:send' with '{ text }' over a socket on GameService
- Empty or whitespace messages are rejected and any excess whitespace in a valid message is trimmed. 
- Text over 500 characters in length will be rejected 
- Messages are rejected after the game has concluded
### Receiving
- The server sends out 'chat:message' to the sender's team room 'game:<id>:<team>' with {id, userId, displayName, team, text, sentAt}'. The sender recieves that information too.
- The other teams socket should not recieve this information at all. 
### Storage
- Each accepted message is saved into a new DB table called `team_messages` which will have columns: game_id, team, user_id, text, sent_at
### Frontend 
- The already existing `useTeamChat()` in `frontend/app/editor/chat-context.tsx` stays the same shape. 
- send emits chat:send, and messages is filled from incoming chat:message events instead of local state.

## Requirements
- Use the existing GameService socket auth and team rooms implementation. 
- The server picks the team that recieves the messages, never the client. 
- Each stored message uses the sender's game id and user id from their authenticated socket.

## Acceptance criteria
1. A players `chat:send` is delivered as a `chat:message` to every connected teammate. 
2. The sender of `chat:send` recieves their own `chat:message` as well
3. Players from the opposing team do not recieve `chat:message` 
4. A `chat:send` with White-space only text is rejected and it is not saved to the `team_messages` db and no `chat:message` is sent.
5. A `chat:send` message with text longer than 500 characters is rejected and is not saved to the `team_messages` db and no `chat:message` is sent.
6. A valid message saves game_id, team, user_id, text and sent_at to the `team_messages` db. 
7. In the frontend, calling `send` emits `chat:send` with the trimmed text.
8. In the frontend an incoming `chat:message` appears in `messages` once. 
9. Messages are rejected after the game ends and are not saved to the DB and no `chat:message` is sent.