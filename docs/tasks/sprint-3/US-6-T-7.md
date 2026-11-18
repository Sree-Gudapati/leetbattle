---
id: US-6-T-7
story: US-6
sprint: 3
assignee: Tyer Ham
estimate_hours: 3
---

# Practice Editor Saves Teammates Code. 

## Description
Serves US-6 (In-Game, #67). Users should be able to view their teammates code, accessable by tabs in the editor

## Specs
- During a match, Tabs should appear on the left column represent the users workspace, as well as up to two other tabs that represent their teammates workspaces
- Teammates workspaces should display the question theyre working on, but the editors should not be interactable
- Users should be able to view teammates other questions.

## Requirements
- websocket server in GameService should save a reference of all players written code
- clients should push text changes at a rate of around 40hz (rate doesnt need to be tested)
- User code should be push only: do not attempt to overwrite users code with references from the server in event of a desync
- User code should be readable by all teammates
- Game page should have tabs above the view in order to switch workspaces from user to teammates
- Editor for teammates should be read only
- Editor for teammates should optimally use the same UI components as the working editor, just with different data passed in

## Scope
- frontend/app/game
- frontend/test
- service/GameService

## Acceptance criteria
- Users should be able to navigate into their teammates code workspaces and view their current code

