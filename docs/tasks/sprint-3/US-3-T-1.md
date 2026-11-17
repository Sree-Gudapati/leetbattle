---
id: US-3-T-1
story: US-3
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# Team chat panel on the match screen

## Description
Serves US-3 (Communication, #41). The match screen gets a team chat panel under the question, where a player can read their team's comments and post one. Issue #51.

## Specs
- The match screen shows a "Team chat" panel under the question.
- Each comment shows its text and the name of the player who posted it.
- When the team has no comments, the panel shows "No messages yet".
- A player posts a comment with the "Send" button or by pressing Enter in the message box.
- A posted comment shows the signed-in player's name, has the spaces around it trimmed, and the message box is emptied after posting.
- "Send" is disabled while the message box is empty or only has spaces.
- UI only for now: messages are kept on the page, so a posted comment is seen only by the player who posted it and is lost on refresh. Sending and receiving over the match websocket is #52.

## Requirements
- The comments live in `frontend/app/editor/chat-context.tsx`, the panel in `frontend/app/editor/components/team-chat.tsx`, and it is rendered from `frontend/app/editor/page.tsx`.
- `chat-context.tsx` is the one place to change when messages move to the match websocket (#52).
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/chat.test.tsx`) use mocked comments and do not touch backend services.

## Acceptance criteria
1. The match screen has a "Team chat" panel.
2. A player can read their team's comments, each with the name of the player who posted it.
3. "No messages yet" is shown when there are no comments.
4. A player can post a comment with "Send" or Enter, and it appears with their name, trimmed.
5. "Send" is disabled when the message box is empty or only has spaces.
