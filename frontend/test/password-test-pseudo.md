// US5-Task13 (#98): changing the password keeps Settings signed in (AuthService is faked with a stubbed fetch)

 // AuthService signs out older sessions after a password change, and answers with a new token
 //  - After changing the password in Settings, the new token from POST /password should be stored

// US5-Task10 (#85): show password (no backend involved)

 // A password field should hide what is typed until the player asks to see it
 //  - On the sign-in page, the password field should hide its text by default
 //  - Clicking "Show password" should show the text
 //  - After showing, the button should be labelled "Hide password"
 //  - Clicking "Hide password" should hide the text again
 //  - The button should say whether it is pressed, for screen readers
 //  - On the sign-up page, the password field should also have a "Show password" button
 //  - In Settings, both password fields should have a "Show password" button
 //  - In Settings, showing the current password should not show the new password
 //  - A field that is not a password (Email) should not have a "Show password" button

// US5-Task9 (#84): forgot password (every test fakes AuthService with a stubbed fetch)

 // A player should be able to ask for a reset link from the sign-in page
 //  - The sign-in page should display "Forgot password?"
 //  - The sign-up page should not display "Forgot password?"
 //  - Clicking "Forgot password?" should display the "Reset your password" form
 //  - Submitting the form should send the email to POST /password/forgot
 //  - After the request succeeds, "Check your email" should be displayed
 //  - The confirmation should say the link works for 30 minutes
 //  - When the request fails, the error should be displayed
 //  - Clicking "Back to log in" on the form should display the log in form again
 //  - Clicking "Back to log in" on the confirmation should display the log in form again

 // A player should be able to choose a new password from the emailed link (/login/reset?token=...)
 //  - With a token in the link, the page should display "Choose a new password"
 //  - Submitting should send the token and the new password to POST /password/reset
 //  - After the request succeeds, "Password changed" should be displayed
 //  - After the request succeeds, a link to the log in page should be displayed
 //  - When the server rejects the token, its error should be displayed
 //  - Without a token in the link, "This reset link is not valid." should be displayed
 //  - Without a token in the link, the new password field should not be displayed
