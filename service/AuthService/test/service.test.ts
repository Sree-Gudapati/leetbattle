import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { request } from './setup';
import { pool } from '../src/db';
import { encryptJwe } from '../src/utils/jwe';
import { mailer } from '../src/utils/mailer';

describe('GET /', () => {
	it('returns a welcome message', async () => {
		const res = await request.get('/');
		expect(res.status).toBe(200);
		expect(res.body.service).toBe('auth-service');
	});
});

describe('signup / login / me / logout', () => {
	const email = 'signup-flow@example.com';
	const password = 'correct-horse-battery-staple';

	it('signs up a new user and returns a session token', async () => {
		const res = await request
			.post('/signup')
			.send({ email, password, name: 'Test User' });
		expect(res.status).toBe(201);
		expect(res.body.user.email).toBe(email);
		expect(res.body.token).toBeTypeOf('string');
	});

	it('rejects a duplicate signup', async () => {
		const res = await request
			.post('/signup')
			.send({ email, password, name: 'Test User' });
		expect(res.status).toBe(409);
	});

	it('rejects login with the wrong password', async () => {
		const res = await request
			.post('/login')
			.send({ email, password: 'wrong-password' });
		expect(res.status).toBe(401);
	});

	it('logs in with the right credentials and reaches /me', async () => {
		const loginRes = await request.post('/login').send({ email, password });
		expect(loginRes.status).toBe(200);
		const token = loginRes.body.token;

		const meRes = await request.get('/me').set('Authorization', `Bearer ${token}`);
		expect(meRes.status).toBe(200);
		expect(meRes.body.user.email).toBe(email);
	});

	it('rejects /me without a token', async () => {
		const res = await request.get('/me');
		expect(res.status).toBe(401);
	});

	it('rejects /me with a garbage token', async () => {
		const res = await request.get('/me').set('Authorization', 'Bearer not-a-real-token');
		expect(res.status).toBe(401);
	});

	it('logs out', async () => {
		const logoutRes = await request.post('/logout');
		expect(logoutRes.status).toBe(204);
	});
});

describe('account settings', () => {
	const email = 'settings-flow@example.com';
	const password = 'correct-horse-battery-staple';

	it('changes the password while logged in', async () => {
		await request.post('/signup').send({ email, password });
		const loginRes = await request.post('/login').send({ email, password });
		const token = loginRes.body.token;

		const changeRes = await request
			.post('/password')
			.set('Authorization', `Bearer ${token}`)
			.send({ currentPassword: password, newPassword: 'brand-new-password' });
		expect(changeRes.status).toBe(200);

		const reLoginRes = await request
			.post('/login')
			.send({ email, password: 'brand-new-password' });
		expect(reLoginRes.status).toBe(200);
	});

	it('updates the display name while logged in', async () => {
		const loginRes = await request
			.post('/login')
			.send({ email, password: 'brand-new-password' });
		const token = loginRes.body.token;

		const updateRes = await request
			.patch('/account')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: 'Updated Name' });
		expect(updateRes.status).toBe(200);
		expect(updateRes.body.user.name).toBe('Updated Name');
	});
});

// Any pool.query mock installed below is restored immediately after the test
// that needs it, but this is a backstop in case an assertion throws first.
afterEach(() => {
	vi.restoreAllMocks();
});

describe('signup validation and error handling', () => {
	it('rejects signup with a missing request body', async () => {
		// No .send() call means express.json() has nothing to parse, so it
		// defaults req.body to {} and email/password come out undefined,
		// which fails the email check.
		//
		// Note: `req.body ?? {}` itself (the nullish-coalescing fallback)
		// looks unreachable through any real HTTP request here - sending a
		// literal JSON `null` body gets rejected by express.json()'s strict
		// mode (only objects/arrays are accepted at the top level) before
		// the request ever reaches this handler, and omitting the body
		// entirely makes body-parser default req.body to {}, never
		// undefined/null. Leaving the fallback in place as defensive code.
		const res = await request.post('/signup');
		expect(res.status).toBe(400);
	});

	it('rejects signup with an invalid email', async () => {
		const res = await request
			.post('/signup')
			.send({ email: 'not-an-email', password: 'a-long-enough-password' });
		expect(res.status).toBe(400);
	});

	it('rejects signup with a password under 8 characters', async () => {
		const res = await request
			.post('/signup')
			.send({ email: 'short-password@example.com', password: 'short' });
		expect(res.status).toBe(400);
	});

	it('responds 500 when the database fails during signup', async () => {
		// Force a genuine failure inside the handler's try block by making
		// the very next pool.query call reject, exercising catch(err) -> next(err).
		vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection lost'));
		const res = await request
			.post('/signup')
			.send({ email: 'db-error-signup@example.com', password: 'a-long-enough-password' });
		expect(res.status).toBe(500);
	});
});

describe('login validation and error handling', () => {
	it('rejects login with a missing request body', async () => {
		const res = await request.post('/login');
		expect(res.status).toBe(400);
	});

	it('responds 500 when the database fails during login', async () => {
		vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection lost'));
		const res = await request
			.post('/login')
			.send({ email: 'anyone@example.com', password: 'whatever123' });
		expect(res.status).toBe(500);
	});
});

describe('me error handling', () => {
	it('rejects /me when the token is valid but the user no longer exists', async () => {
		// A well-formed UUID that was never inserted: requireAuth accepts the
		// token (it only checks the JWE decrypts), but the handler's own
		// `!user` check must reject it since the row doesn't exist.
		const token = await encryptJwe('00000000-0000-0000-0000-000000000000', 'ghost@example.com');
		const res = await request.get('/me').set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(401);
	});

	it('responds 500 when the database fails looking up the current user', async () => {
		// `id` is a UUID column; a non-UUID-shaped id makes Postgres itself
		// throw while binding the query parameter - a genuine, unmocked DB error.
		const token = await encryptJwe('not-a-uuid', 'ghost@example.com');
		const res = await request.get('/me').set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(500);
	});
});

describe('changePassword validation and error handling', () => {
	const email = 'change-password-errors@example.com';
	const password = 'correct-horse-battery-staple';
	let token: string;

	beforeAll(async () => {
		await request.post('/signup').send({ email, password });
		const loginRes = await request.post('/login').send({ email, password });
		token = loginRes.body.token;
	});

	it('rejects a password change with a missing request body', async () => {
		const res = await request
			.post('/password')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(400);
	});

	it('rejects a password change with the wrong current password', async () => {
		const res = await request
			.post('/password')
			.set('Authorization', `Bearer ${token}`)
			.send({ currentPassword: 'definitely-wrong', newPassword: 'another-long-password' });
		expect(res.status).toBe(401);
	});

	it('responds 500 when the database fails during a password change', async () => {
		const badToken = await encryptJwe('not-a-uuid', email);
		const res = await request
			.post('/password')
			.set('Authorization', `Bearer ${badToken}`)
			.send({ currentPassword: password, newPassword: 'another-long-password' });
		expect(res.status).toBe(500);
	});
});

describe('updateAccount validation and error handling', () => {
	const email = 'update-account-errors@example.com';
	const password = 'correct-horse-battery-staple';
	let token: string;

	beforeAll(async () => {
		await request.post('/signup').send({ email, password });
		const loginRes = await request.post('/login').send({ email, password });
		token = loginRes.body.token;
	});

	it('rejects an account update with a missing request body', async () => {
		const res = await request
			.patch('/account')
			.set('Authorization', `Bearer ${token}`);
		expect(res.status).toBe(400);
	});

	it('rejects /account when the token is valid but the user no longer exists', async () => {
		const ghostToken = await encryptJwe('00000000-0000-0000-0000-000000000000', 'ghost@example.com');
		const res = await request
			.patch('/account')
			.set('Authorization', `Bearer ${ghostToken}`)
			.send({ name: 'New Name' });
		expect(res.status).toBe(401);
	});

	it('responds 500 when the database fails during an account update', async () => {
		const badToken = await encryptJwe('not-a-uuid', email);
		const res = await request
			.patch('/account')
			.set('Authorization', `Bearer ${badToken}`)
			.send({ name: 'New Name' });
		expect(res.status).toBe(500);
	});
});

// US5-Task9 (#84). Pseudocode: test/password-reset-test-pseudo.md
// No real email is sent in these tests: mailer.sendPasswordReset is replaced
// with a spy, which also lets a test read the link the player would receive.

// Replaces the mailer with a spy that sends nothing.
function fakeMailer() {
	return vi.spyOn(mailer, 'sendPasswordReset').mockResolvedValue();
}

// Asks for a reset link for `email` and returns the link from the (faked) email.
async function requestResetLink(email: string): Promise<string> {
	const send = fakeMailer();
	await request.post('/password/forgot').send({ email });
	return send.mock.calls[0][1];
}

// Asks for a reset link and returns just the token in it.
async function requestResetToken(email: string): Promise<string> {
	return new URL(await requestResetLink(email)).searchParams.get('token') ?? '';
}

describe('asking for a password reset link', () => {
	const email = 'forgot-flow@example.com';

	beforeAll(async () => {
		await request.post('/signup').send({ email, password: 'correct-horse-battery-staple' });
	});

	it('US5-Task9 responds 200 for the email of an account', async () => {
		fakeMailer();
		const res = await request.post('/password/forgot').send({ email });
		expect(res.status).toBe(200);
	});

	it('US5-Task9 sends the reset email to the account\'s address', async () => {
		const send = fakeMailer();
		await request.post('/password/forgot').send({ email });
		// The first argument of the mailer is the address the email goes to.
		expect(send.mock.calls[0][0]).toBe(email);
	});

	it('US5-Task9 links to the frontend\'s reset page with a token', async () => {
		const link = await requestResetLink(email);
		// The token is 32 random bytes written as 64 hex characters.
		expect(link).toMatch(/^http:\/\/localhost:3000\/login\/reset\?token=[0-9a-f]{64}$/);
	});

	it('US5-Task9 responds 200 for an email with no account', async () => {
		fakeMailer();
		// Same answer as for a real account, so nobody can probe which emails are registered.
		const res = await request.post('/password/forgot').send({ email: 'nobody@example.com' });
		expect(res.status).toBe(200);
	});

	it('US5-Task9 sends no email when there is no account', async () => {
		const send = fakeMailer();
		await request.post('/password/forgot').send({ email: 'nobody@example.com' });
		expect(send).not.toHaveBeenCalled();
	});

	it('US5-Task9 answers the same for an email with and without an account', async () => {
		fakeMailer();
		const known = await request.post('/password/forgot').send({ email });
		const unknown = await request.post('/password/forgot').send({ email: 'nobody@example.com' });
		// Identical bodies give nothing away about which emails are registered.
		expect(known.body).toEqual(unknown.body);
	});

	it('US5-Task9 still responds 200 when the email cannot be sent', async () => {
		// A 500 here would only ever happen for real accounts, revealing that the account exists.
		vi.spyOn(mailer, 'sendPasswordReset').mockRejectedValue(new Error('mail provider down'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const res = await request.post('/password/forgot').send({ email });
		expect(res.status).toBe(200);
	});

	it('US5-Task9 stops the first link from working when a second one is requested', async () => {
		const first = await requestResetToken(email);
		vi.restoreAllMocks();
		await requestResetToken(email);
		const res = await request.post('/password/reset').send({ token: first, newPassword: 'a-brand-new-password' });
		expect(res.status).toBe(400);
	});

	it('US5-Task9 responds 400 when no email is given', async () => {
		const res = await request.post('/password/forgot');
		expect(res.status).toBe(400);
	});

	it('US5-Task9 responds 500 when the database fails', async () => {
		// Make the handler's first query reject, exercising catch(err) -> next(err).
		vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection lost'));
		const res = await request.post('/password/forgot').send({ email });
		expect(res.status).toBe(500);
	});
});

describe('choosing a new password with a reset link', () => {
	const email = 'reset-flow@example.com';
	const oldPassword = 'correct-horse-battery-staple';
	const newPassword = 'a-brand-new-password';

	beforeAll(async () => {
		await request.post('/signup').send({ email, password: oldPassword });
	});

	it('US5-Task9 responds 200 for the token from the email and a new password', async () => {
		const token = await requestResetToken(email);
		const res = await request.post('/password/reset').send({ token, newPassword });
		expect(res.status).toBe(200);
	});

	it('US5-Task9 lets the player log in with the new password after a reset', async () => {
		// The previous test already reset this account's password.
		const res = await request.post('/login').send({ email, password: newPassword });
		expect(res.status).toBe(200);
	});

	it('US5-Task9 no longer accepts the old password after a reset', async () => {
		const res = await request.post('/login').send({ email, password: oldPassword });
		expect(res.status).toBe(401);
	});

	it('US5-Task9 rejects a token that has already been used', async () => {
		const token = await requestResetToken(email);
		await request.post('/password/reset').send({ token, newPassword });
		// Second use of the same link.
		const res = await request.post('/password/reset').send({ token, newPassword: 'yet-another-password' });
		expect(res.status).toBe(400);
	});

	it('US5-Task9 rejects a token that was never issued', async () => {
		const res = await request.post('/password/reset').send({ token: 'f'.repeat(64), newPassword });
		expect(res.status).toBe(400);
	});

	it('US5-Task9 rejects a token older than 30 minutes', async () => {
		const token = await requestResetToken(email);
		// Age every outstanding link past its 30 minute life.
		await pool.query('UPDATE password_resets SET expires_at = now() - interval \'1 minute\'');
		const res = await request.post('/password/reset').send({ token, newPassword });
		expect(res.status).toBe(400);
	});

	it('US5-Task9 rejects a new password under 8 characters', async () => {
		const token = await requestResetToken(email);
		const res = await request.post('/password/reset').send({ token, newPassword: 'short' });
		expect(res.status).toBe(400);
	});

	it('US5-Task9 responds 400 when no body is given', async () => {
		const res = await request.post('/password/reset');
		expect(res.status).toBe(400);
	});

	it('US5-Task9 responds 500 when the database fails', async () => {
		vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection lost'));
		const res = await request.post('/password/reset').send({ token: 'f'.repeat(64), newPassword });
		expect(res.status).toBe(500);
	});
});
