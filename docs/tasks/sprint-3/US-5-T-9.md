---
id: US-5-T-9
story: US-5
sprint: 3
assignee: Sashreek Rewatkar
estimate_hours: 2 - 3
---

# Forgot password option

## Description
Serves US-5 (UI/UX). A player who has forgotten their password can ask for a reset link from the sign-in page and choose a new password from that link. Issue #84.

## Specs
- The sign-in page shows "Forgot password?" under the password field. The sign-up page does not.
- "Forgot password?" opens a "Reset your password" form that asks for the account email.
- Sending the form shows a "Check your email" confirmation, which says the link works for 30 minutes.
- Both the form and the confirmation have "Back to log in".
- The emailed link opens `/login/reset?token=...`, where the player types a new password of at least 8 characters.
- After the password is changed, the page shows "Password changed" and a link to log in.
- A link with no token, a used link or an expired link shows an error instead.
- AuthService `POST /password/forgot` takes an email and always answers the same way, whether or not the email has an account.
- AuthService `POST /password/reset` takes the token and the new password. A link works once and for 30 minutes, and asking for a new link cancels the earlier one.
- Only the SHA-256 of a token is stored, in the `password_resets` table.

## Requirements
- The sign-in views live in `frontend/app/login/page.tsx` and the reset page in `frontend/app/login/reset/page.tsx`.
- The endpoints live in `service/AuthService/src/service.ts`. The table is in `service/AuthService/sql/schema.sql` and must also be created in the Cloud SQL database.
- The project has no email provider yet. `service/AuthService/src/utils/mailer.ts` writes the reset link to the service log, and is the one place to change when a provider is added.
- Use only the theme classes defined in docs/frontend/theming.md. No new dependencies.
- Frontend tests (`frontend/test/password.test.tsx`) stub the network and do not touch backend services. AuthService tests (`service/AuthService/test/service.test.ts`) fake the mailer.

## Acceptance criteria
1. "Forgot password?" is shown on the sign-in page and not on the sign-up page.
2. Sending the reset form posts the email to AuthService and shows "Check your email".
3. A failed request shows its error.
4. The reset page posts the token and the new password to AuthService and shows "Password changed".
5. The reset page shows an error for a missing, used or expired link.
6. `POST /password/forgot` answers the same for an email with and without an account, and when the email cannot be sent.
7. After a reset, the new password logs in and the old one does not.
8. A reset link works only once, and stops working after 30 minutes or when a newer link is requested.
