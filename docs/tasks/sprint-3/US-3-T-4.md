---
id: US-3-T-4
story: US-3
sprint: 3
assignee: Sree Satya Jayanth Gudapati
estimate_hours: 3
---

# Basic safeguards for team chat

## Description
Serves US-3 Communication for task 4. Basic safeguards and upkeep for team chat during a match. The current implementation limits messages to 500 characters and keeps chat within a team. This task adds rate limiting, deletes old messages from the DB, and makes chat errors temporary (today an error stays on screen for the rest of the match). Injection is already prevented (React for HTML, parameterized queries for SQL). This task adds tests that prove it.

Out of scope: profanity filtering, loading chat history, and cross-team chat.

## Specs
### Rate limiting
- A player can send at most 1 message per second. The limit is per player (shared across all their tabs/sockets), not per socket.
- A message sent too soon is rejected before it is saved. It is not stored in `team_messages` and no `chat:message` is sent.
- A rejected message does not count toward the rate limit.
- GameService answers a rate-limited `chat:send` with an error "Whoa, slow down!". 

### Frontend
- When a message is rejected (rate limited or too long), the text stays in the message box. The box is cleared only after the message is accepted.
- A chat error disappears after 5 seconds, or sooner when the player sends a message that is accepted.

### Injection
This was already handled in the initial implementation so it will be tests only in this PR.
- HTML injection: chat text is rendered as React text. React automatically escapes, meaning it converts special characters in values rendered inside JSX into safe text representations.
- SQL injection: messages are saved with a parameterized query ($1, $2, ...), so text is never run as SQL.

### Old message cleanup
- Messages older than 10 days are deleted from `team_messages`.
- Cleanup runs whenever a game ends.



## Requirements
- No new libraries.

## Acceptance criteria
1. A second `chat:send` from the same player within 1 second is rejected with "Whoa, slow down!"
2. A message that was rejected is not saved to `team_messages`, and no `chat:message` is sent.
3. The frontend shows "Whoa, slow down!" in the chat panel when a message is rate limited.
4. When a message is rejected, the message box keeps its text.
5. A chat error shown on the frontend disappears after 5 seconds.
6. HTML / scripts in a message are shown as text and do not run.
7. A message containing SQL is saved and shown as plain text and is not run as a SQL command.
8. When a game ends, messages older than 10 days are deleted.
9. When a game ends, messages newer than 10 days are kept.
