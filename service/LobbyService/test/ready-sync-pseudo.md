// US-1-T-2 Server should own each player's ready state
 //  - A ready request with a non-boolean value (e.g. "yes") should receive an "invalid-ready-status" error
 //  - After a ready request with a non-boolean value, the player should still be not ready

 // US-1-T-2 Every ready change should be broadcast to every client in the lobby
 //  - In a full 3v3 lobby, when one player readies up, every one of the six clients should see that player as ready
 //  - In a full 3v3 lobby, when a readied player un-readies, every one of the six clients should see that player as not ready
 //  - In a full 3v3 lobby, after one player readies up, every client should see a ready count of 1

 // US-1-T-2 Lobby should be ready to start once every player of the chosen size is ready
 //  - In a full 1v1 lobby, once both players ready up, the lobby should report it is ready to start
 //  - In a full 2v2 lobby, once all four players ready up, the lobby should report it is ready to start
 //  - In a full 3v3 lobby, once all six players ready up, the lobby should report it is ready to start

 // US-1-T-2 A readied player cannot switch teams in a full lobby
 //  - A readied player who asks to join the other team should receive a "team-full" error
 //  - After the rejected team switch, that player should still be ready

 // US-1-T-2 Leaving should reset ready state
 //  - When a readied player leaves, every remaining player should be not ready
 //  - When a readied player leaves, the ready count should be 0
