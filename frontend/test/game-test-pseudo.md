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

 // Game page should show the match waiting for its players
 //  - While the game is waiting with 2 of 6 players connected, "Waiting for players (2/6)" should be displayed

 // Players should be able to forfeit from the top bar
 //  - During a match, a "Forfeit" button should appear in the top bar
 //  - The Forfeit button should sit to the left of the account menu button
 //  - While the game is waiting for players, the Forfeit button should not be shown
 //  - Clicking Forfeit should open a confirmation dialog
 //  - Clicking Cancel should close the dialog without forfeiting
 //  - Confirming should send the forfeit to the game
 //  - After confirming, the Forfeit button should be disabled

 // Game page should show the result once the game ends
 //  - When team b wins, "Team 2 wins" should be displayed
 //  - When the game was won by forfeit, "by forfeit" should be displayed
 //  - The result screen should have a "Back to lobby" link
 //  - When the game ends in a draw, "Draw" should be displayed
 //  - Once the game has ended, the Forfeit button should not be shown

 // Game socket context should handle the end of the game
 //  - A "game:ended" event from the server should expose the result to the page
 //  - Forfeiting should send a "game:forfeit" event to the server

 // Game page should show each problem's details
 //  - Each problem in the match pool should show its difficulty
 //  - Before a problem is picked, no problem description should be shown
 //  - Clicking a problem should load it from CodeService by its question_id
 //  - Once loaded, the clicked problem's description should be displayed
 //  - When the problem fails to load, an error should be displayed
 //  (CodeService's fetch is mocked; no test calls a real service)
