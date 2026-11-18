// US-3-T-1: team chat panel on the match screen (all tests use mocked comments, no backend)

 // The match screen should have a team chat panel
 //  - When the match screen loads, a "Team chat" panel should be displayed

 // A player should be able to read team comments
 //  - When the team has two comments, the text of each comment should be displayed
 //  - Each comment should display the name of the player who posted it
 //  - When the team has no comments, "No messages yet" should be displayed

 // A player should be able to post a team comment
 //  - Typing a comment and clicking "Send" should display the comment in the panel
 //  - A posted comment should display the signed-in player's name
 //  - Pressing Enter in the message box should post the comment
 //  - After posting, the message box should be empty
 //  - A posted comment should have the spaces around it trimmed
 //  - When the message box is empty, "Send" should be disabled
 //  - When the message box only has spaces, "Send" should be disabled


// US-3-T-2: team chat messages over the game socket (all tests use a mocked socket, no backend)

 // The chat panel should send comments over the game socket
 //  - Calling "send" should emit "chat:send" with the message text
 //  - After calling "send", the comment should not appear in the panel until the server delivers it
 //  - When there is no game socket, "send" should still show the comment locally (keep passing existing tests)

// The chat panel should show comments the server delivers
//  - An incoming "chat:message" should appear in the panel once
//  - An incoming "chat:message" should show the name of the player who sent it
//  - When the sender's own "chat:message" comes back, it should appear once, not twice
//  - When "chat:send" is answered with "Message too long", the chat bar should show "Message too long"


// The match page should show team chat while the game is being played
//  - While playing, the match page should display a "Team chat" panel
//  - Sending a comment on the match page should emit "chat:send" on the game socket
