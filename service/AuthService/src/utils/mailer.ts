// Sends the emails auth-service needs, through Brevo's HTTP API (US-5-T-11).
// BREVO_API_KEY and MAIL_FROM come from the environment and are read on every
// send. Without a key (local development) the reset link is written to the
// service log instead, as before.
const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

export const mailer = {
	async sendPasswordReset(to: string, link: string): Promise<void> {
		const apiKey = process.env.BREVO_API_KEY;
		if (!apiKey) {
			console.log(`[auth-service] password reset link for ${to}: ${link}`);
			return;
		}

		const text = 'Someone asked to reset the password for your LeetBattle account.\n\n'
			+ `Choose a new password here (the link works for 30 minutes):\n${link}\n\n`
			+ 'If you didn\'t ask for this, you can ignore this email.';
		const res = await fetch(BREVO_SEND_URL, {
			method: 'POST',
			headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({
				sender: { email: process.env.MAIL_FROM, name: 'LeetBattle' },
				to: [{ email: to }],
				subject: 'Reset your LeetBattle password',
				textContent: text,
				htmlContent: '<p>Someone asked to reset the password for your LeetBattle account.</p>'
					+ `<p><a href="${link}">Choose a new password</a> (the link works for 30 minutes).</p>`
					+ '<p>If you didn\'t ask for this, you can ignore this email.</p>',
			}),
		});
		// forgotPassword logs this and still answers 200 (see service.ts).
		if (!res.ok) throw new Error(`Brevo refused the email: ${res.status} ${await res.text()}`);
	},
};
