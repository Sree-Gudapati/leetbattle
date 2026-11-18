---
id: US-6-T-9
story: US-6
sprint: 3
assignee: Tyer Ham
estimate_hours: 1
---

# Practice Editor Saves Teammates Code. 

## Description
Serves US-6 (In-Game, #67). Users should be scored on the percent number of testcases passed.

## Specs
- easy questions are worth 150 points for all tests passed, mediums are worth 300, and hards are worth 450.
- questions should be scored on the percent number of testcases passed, floored to the nearest integer
- points are only calculated on submit, not run
- questions are scored based on the players best submission, meaning the team score will not change if a player submits a submission that scores less points

## Requirements
- when a player submits a question and passes testcases, the teams score should update accordingly
- the score should be updated through the websocket to display for all players
- a winner should be determined at the end depending on which team scored higher, and the win/lose screen should be displayed for every player

## Scope
- frontend/app/game
- frontend/test
- service/GameService

## Acceptance criteria
- Users should be able to submit code and receive points
- The points should reflect back on the team score
- The team score should update for all players
