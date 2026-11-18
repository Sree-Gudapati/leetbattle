// US5-Task11 (#96): send the password reset email through Brevo (fetch is faked in every test; Brevo is never called)

 // With a Brevo key, the reset link should be emailed
 //  - sendPasswordReset should POST to https://api.brevo.com/v3/smtp/email
 //  - The request should carry the Brevo key in the "api-key" header
 //  - The email should go to the address it was given
 //  - The email should come from the MAIL_FROM address
 //  - The email should contain the reset link
 //  - The email should say the link works for 30 minutes
 //  - When Brevo refuses the email (not a 2xx answer), sendPasswordReset should throw
 //  - With a key, the reset link should not be written to the log

 // Without a Brevo key (local development), the link should go to the log instead
 //  - The reset link should be written to the log
 //  - Nothing should be sent to Brevo
