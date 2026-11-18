// US-6-T-8 GET /game/:id should only answer for the logged-in player
 //  - A request with no Authorization header should return 401
 //  - A request with an invalid token should return 401
 //  - A request for another player's id should return 403
 //  - A request for another player's id should not include a gameId in the response body

 // US-6-T-8 GET /game/:id should tell the player how to rejoin their active match
 //  - A request for the token's own user with an active match should return 200
 //  - The response should include the gameId of the player's active match
 //  - The response should include the GameService WebSocket URL as socketUrl
 //  - The response should include "/game/<gameId>" as gameRoute
 //  - A request for the token's own user with no active match should return 404
