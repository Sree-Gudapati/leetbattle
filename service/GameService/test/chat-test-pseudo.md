// US-3-T-2: team chat over the GameService socket
// All tests use a fresh game with at least two players on each team.
// All players must be confirmed to be connected to the GameService before running any tests and no team is marked as left. 

// GameService should deliver a team chat message to the sender's team
 //  - A player's "chat:send" should be delivered as a "chat:message" to every connected teammate
 //  - The sender should receive their own "chat:message"
 //  - A "chat:message" should carry the message id, sender's user id, display name, team, text and sent time
 //  - A player on the other team should not receive the "chat:message"

 
// GameService should limit message text
//  - A "chat:send" with no more than 500 characters should be delivered
//  - A "chat:send" with text longer than 500 characters should not send "chat:message"
//  - A "chat:send" with text longer than 500 characters should give the user an error saying "Message too long"


 // GameService should save each accepted team message
 //  - A valid "chat:send" should add one row to "team_messages"
 //  - The saved row should have the game's id
 //  - The saved row should have the sender's team
 //  - The saved row should have the sender's user id
 //  - The saved row should have a sent time that is set
 //  - The saved row should have the message body as text
 //  - A "chat:send" with text longer than 500 characters should not be saved to "team_messages"

 // GameService should not take chat messages after the game has ended
 //  - After "game:ended", a "chat:send" should not be saved to "team_messages"
 //  - After "game:ended", a "chat:send" should send no "chat:message"

 // GameService should keep chat separate between games
 //  - When two games are running, a "chat:send" in one game should not reach the players of the other game
 //  - The saved "team_messages" row should have the id of the game the message was sent in
