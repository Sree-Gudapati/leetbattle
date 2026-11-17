// Sends the emails auth-service needs. The project has no email provider yet,
// so the reset link is written to the service log instead of being emailed.
// Swapping in a real provider only means changing sendPasswordReset.
export const mailer = {
	async sendPasswordReset(to: string, link: string): Promise<void> {
		console.log(`[auth-service] password reset link for ${to}: ${link}`);
	},
};
