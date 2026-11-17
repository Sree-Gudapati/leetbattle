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
