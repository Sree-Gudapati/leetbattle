---
id: US-1-T-3
story: US-1
sprint: 3
assignee: Tyler Ham
estimate_hours: 2 - 4
---

# Starting match once players are ready

## Description
Create the GameService, which handles managing game states.

## Specs
- Upon all players readying up, players should be navigated to the game page 
- 

## Requirements
- CodeService must manage gameIDs, 
- CodeService must manage gameIDs, playerIDs and their teams, points, when the match was started
- CodeService must make a request to CodeService to obtain a bank of questions to chose from
- CodeService must expose endpoints to start a game, returning the game id
- CodeService must expose endpoints to access game data from a player id
- Use the existing LobbyService code to make a request to the CodeService
- Create a route for LobbyPage to navigate to after recieving a response from the LobbyService


## Acceptance criteria
1. Database should contain records of a match being started once a round starts
2. A player will be redirected to a game page once a game starts
