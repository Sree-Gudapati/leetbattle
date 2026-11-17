// US-6-T-2: Lobby should start a game on GameService when the countdown completes
 //  - When the countdown completes with all six players ready, the lobby should call GameService exactly once
 //    (the PUT /game request, the "lobby:game-started" event with the gameId, and closing the
 //    lobby sockets are covered by tyler-ham05's "Lobbyservice makes request to GameService" tests)

 // Lobby should not start a game when a player backs out
 //  - If a player becomes unready during the countdown, GameService should not be called

 // Lobby should recover when GameService cannot start the game
 //  - When GameService responds with an error status, every lobby client should receive a "game-start-failed" error
 //  - When GameService is unreachable, every lobby client should receive a "game-start-failed" error
 //  - When the game fails to start, every player's ready state should be reset
 //  - After a failed start, players can ready up again and the lobby should call GameService a second time
