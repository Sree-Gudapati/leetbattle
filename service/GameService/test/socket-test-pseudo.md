// US-6-T-2: GameService socket should require authentication
 //  - Connections without a valid login token should be rejected with "unauthorized"
 //  - A logged-in user who is not a player in the game should be rejected with "not-in-game"
 //  - A connection for a gameId that does not exist should be rejected with "not-in-game"

 // GameService socket should send the game state to a player who joins
 //  - The "game:state" event should carry the gameId the player connected to
 //  - The game state should list all six players
 //  - The game state should list the nine problems in the match pool
 //  - The joining player should be shown as connected
 //  - The game state should include how many seconds remain in the match

 // GameService socket should put each player in their team's room
 //  - A player on team a should be in the "game:<gameId>:a" room
 //  - A player on team a should not be in the "game:<gameId>:b" room

 // GameService socket should keep every player's connection status up to date
 //  - When a second player joins, players already connected should receive a game state showing two connected players
 //  - When a player's socket drops, the remaining players should receive a game state showing that player as disconnected
