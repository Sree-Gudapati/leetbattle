// US5-Task9 (#84): forgot password, AuthService side (the email itself is faked in every test)

 // A player should be able to ask for a password reset link
 //  - POST /password/forgot with the email of an account should respond 200
 //  - It should send a reset email to that account's address
 //  - The link in the email should point at the frontend's reset page with a token
 //  - POST /password/forgot with an email that has no account should also respond 200 (so nobody can check which emails have accounts)
 //  - It should not send an email when there is no account
 //  - The response should be the same whether or not the email has an account
 //  - When the email cannot be sent, POST /password/forgot should still respond 200 (a failure must not reveal that the account exists)
 //  - Asking for a second link should stop the first link from working
 //  - POST /password/forgot without an email should respond 400
 //  - When the database fails, POST /password/forgot should respond 500

 // A player should be able to choose a new password with the link
 //  - POST /password/reset with the token from the email and a new password should respond 200
 //  - After a reset, the player should be able to log in with the new password
 //  - After a reset, the old password should no longer log in
 //  - A token should only work once: using it a second time should respond 400
 //  - A token that was never issued should respond 400
 //  - A token older than 30 minutes should respond 400
 //  - A new password under 8 characters should respond 400
 //  - POST /password/reset without a body should respond 400
 //  - When the database fails, POST /password/reset should respond 500
