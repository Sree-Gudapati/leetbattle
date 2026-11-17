// US-6-T-2: Lobby should hand players over to the game
 //  - When "lobby:game-started" arrives with a gameId, the lobby should navigate to /game/<gameId>
 //  - After "lobby:ready-for-match" and before the gameId arrives, the status should display "Joining match…"

 // Game page should connect to the game socket for the game in the URL
 //  - On open, the page should connect using the gameId from the URL
 //  - While the socket is not connected, "Joining match…" should be displayed
 //  (LobbyService closes the lobby sockets itself once the game starts, so the page doesn't)

 // Game page should show connection problems
 //  - When the socket context has an error, its message should appear in an alert
 //  - When the connection fails, a link back to the lobby should be shown

 // Game page should show the match once connected
 //  - Each player's display name should be rendered
 //  - Team 1 should list its three players
 //  - A player who is not connected should display "Reconnecting…"
 //  - Each problem in the match pool should be listed
 //  - The time remaining should be displayed as minutes and seconds

 // Game socket context should connect with the player's identity
 //  - The socket should be opened with the login token and the gameId in its auth payload
 //  - A "game:state" event from the server should be exposed to the page
 //  - When the server rejects the connection with "not-in-game", a "not a player in this match" error should be exposed
