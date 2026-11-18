// US5-Task13 (#98): harden password reset (the mailer is faked in every test; the rate limit uses fake timers)

 // Changing the password should sign out older sessions
 //  - After a password reset, a token issued before it should get 401 from GET /me
 //  - After a password change in Settings, a token issued before it should get 401 from GET /me
 //  - POST /password should answer with a new token
 //  - The new token from POST /password should reach GET /me
 //  - A token issued after the last password change should still reach GET /me

 // The reset endpoints should be rate limited per IP (5 requests per 15 minutes)
 //  - The 6th POST /password/forgot from one IP within 15 minutes should respond 429
 //  - The 6th POST /password/reset from one IP within 15 minutes should respond 429
 //  - After the 15 minutes pass, POST /password/forgot should work again

 // One address should get at most 3 reset emails an hour
 //  - A 4th POST /password/forgot for the same address within an hour should still respond 200
 //  - A 4th POST /password/forgot for the same address within an hour should not send an email
 //  - After the hour passes, POST /password/forgot should send the email again

 // Emails should not depend on case or surrounding spaces
 //  - Signing up as "Ada@X.com" should store the email as "ada@x.com"
 //  - After signing up as "Ada@X.com", logging in as " ada@x.com " should respond 200
 //  - After "Ada@x.com" exists, signing up as "ada@x.com" should respond 409
 //  - POST /password/forgot for "ADA@x.com" should send the email to "ada@x.com"
