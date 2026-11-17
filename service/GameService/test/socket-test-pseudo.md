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

 // Game should wait for its players before the clock starts
 //  - A new game should be waiting for players
 //  - When every player has connected, the game should start playing
 //  - When the join wait runs out, the game should start with whoever has connected

 // Game should give a dropped player time to reconnect
 //  - Right after a player's socket drops, they should not be marked as left
 //  - When a player reconnects within the window, they should not be marked as left
 //  - When the window runs out, the player should be marked as left
 //  - When every player on a team has left, the other team should win by disconnect

 // Players should be able to forfeit as a team
 //  - When one of two connected teammates forfeits, the game should keep going with one forfeit vote counted
 //  - The same player forfeiting twice should count once
 //  - When every connected teammate has forfeited, the other team should win by forfeit

 // Game should shut down cleanly once it ends
 //  - Once the game ends, the players' sockets should be closed
 //  - Once the game ends, connecting to it should be rejected with "not-in-game"
 //  - Once the game ends, the players should no longer have an active game

 // GameService socket should send enough about each problem for the game page to load it
 //  - Each problem in the match pool should carry its task_id
 //  - Each problem in the match pool should carry the question_id CodeService looks problems up by
 //  - Each problem in the match pool should carry its difficulty

 // Players should be able to submit a solution through the game
 //  - A correct solution should come back from CodeService as "Accepted"
 //  - The code should be graded by CodeService using the problem's question_id
 //  - Once a solution is accepted, the game state should show that problem as solved for the submitter's team
 //  - A wrong solution should not mark the problem as solved
 //  - A problem that isn't in the match pool should be rejected with "unknown-problem"
 //  - Submitting before the game has started should be rejected with "not-playing"
 //  - When CodeService fails, the submission should be rejected with "grading-failed"

 // Teams should not be able to spam submissions
 //  - While a teammate's submission is being graded, another submission from the same team should be rejected with "team-busy"
 //  - While one team's submission is being graded, the other team should still be able to submit
 //  - Right after a team's submission is graded, its next submission should be rejected with "cooldown"
 //  - Once the cooldown has passed, the team should be able to submit again

 // Game should end once a team solves every problem
 //  - When a team has solved every problem in the pool, that team should win with reason "solved"
