// US-6-T-8 (all API and WebSocket responses are mocked; no real services are called)

 // US-6-T-8 App should check for an active match without blocking navigation
 //  - On initial load with a signed-in user, the app should request GET /game/<userId> with the login token
 //  - When no user is signed in, the app should not request GET /game/<userId>
 //  - After a route change, the app should request GET /game/<userId> again
 //  - While the check is still pending, the new page's content should already be rendered
 //  - On a /game/<gameId> route, the app should not request GET /game/<userId>

 // US-6-T-8 Navigation should show Rejoin Match while the player has an active match
 //  - When the check returns an active match, a "Rejoin Match" button should be shown
 //  - After a refresh (fresh render) with an active match, a "Rejoin Match" button should be shown
 //  - When the check returns 404, no "Rejoin Match" button should be shown
 //  - When the check fails with a network error, no "Rejoin Match" button should be shown

 // US-6-T-8 Clicking Rejoin Match should return the player to their match
 //  - Clicking "Rejoin Match" should navigate to the gameRoute from the check (/game/<gameId>)
 //  - On the game page reached by rejoining, the socket should connect with the same gameId
 //  - When the game socket sends the current game state, the game page should show that match's players

 // US-6-T-8 App should explain when the match ended before the rejoin
 //  - When the game socket rejects the connection with "not-in-game", "This match is no longer available." should be displayed
 //  - After the "not-in-game" rejection, no "Rejoin Match" button should be shown
