// US-4-T-4 (#58): scoreboard on the match screen (UI only, all tests use mocked match data, no backend)

 // The scoreboard should display both team scores
 //  - "Team 1" should be displayed
 //  - "Team 2" should be displayed
 //  - When Team 1 has 120 points, "120" should be displayed as the Team 1 score
 //  - When Team 2 has 80 points, "80" should be displayed as the Team 2 score
 //  - The Team 1 score should use the primary colour
 //  - The Team 2 score should use the secondary colour

 // The scoreboard should display the match timer
 //  - The timer should be labelled "Time left"
 //  - When 754 seconds are left, "12:34" should be displayed
 //  - When 65 seconds are left, "01:05" should be displayed
 //  - When no time is left, "00:00" should be displayed
 //  - After one second passes, the match should have one second less left

 // The scoreboard should display recent submissions
 //  - When there are two submissions, the name of each player who submitted should be displayed
 //  - A submission should display its question as "Question 3"
 //  - An accepted submission should display "Accepted"
 //  - An accepted submission worth 50 points should display "+50"
 //  - A failed submission should display "Wrong answer"
 //  - When there are no submissions, "No submissions yet" should be displayed
 //  - When there are seven submissions, only the five most recent should be displayed

 // The match screen should display the scoreboard
 //  - When the match screen loads, the scoreboard should be displayed

// US5-Task17 (#133): the scoreboard is one compact line
//  - The scoreboard should show Team 1's score, the time left and Team 2's score, in that order
//  - The scoreboard should not show the recent submissions list
//  - The scoreboard should not show "No submissions yet"
//  - The scoreboard should not show a "Time left" label
//  - The timer should still be labelled "Time left" for screen readers
//  (replaces the US4-Task4 "Time left" label test and the recent submissions tests)
