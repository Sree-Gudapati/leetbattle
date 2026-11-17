// Lobby should let the host choose how many players are on each team
 //  - A new lobby should default to three players per team
 //  - The first player to join the lobby should be the host
 //  - When the host leaves, the next player who joined should become the host
 //  - When the host sets the team size to 2, every lobby client should see a team size of 2
 //  - A player who is not the host should receive a "not-host" error when changing the team size
 //  - A team size of 4 should be rejected with an "invalid-team-size" error
 //  - A team size of 0 should be rejected with an "invalid-team-size" error

 // Lobby should use the chosen team size for capacity and readiness
 //  - With a team size of 2, a third player joining a team should receive a "team-full" error
 //  - With a team size of 1, two connected players on opposite teams should be able to ready up

 // Lobby should remove extra players when the team size shrinks
 //  - When a team has more players than the new team size, random players should be moved off it until it fits
 //  - A player moved off a team should stay in the lobby without a team when the lobby has room
 //  - When the lobby has more players than the new size allows, random players should be removed until it fits
 //  - The host should never be removed from the lobby when the team size shrinks
 //  - Changing the team size should reset every player's ready state
