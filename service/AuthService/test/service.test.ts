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

// US5-Task13 (#98). Pseudocode: test/password-hardening-test-pseudo.md
// The mailer is faked with fakeMailer() as above. Only Date is faked when a
// test needs time to pass, so the database driver and supertest keep working.
// setup.ts clears the rate limits before every test.

// Signs up `email` and returns the account's id.
async function signUp(email: string, password = 'correct-horse-battery-staple'): Promise<string> {
	const res = await request.post('/signup').send({ email, password });
	return res.body.user.id;
}

// A session token for the account as if it had been issued `minutes` ago.
async function tokenIssuedMinutesAgo(id: string, email: string, minutes: number): Promise<string> {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.now() - minutes * 60_000);
	const token = await encryptJwe(id, email);
	vi.useRealTimers();
	return token;
}

// Moves the clock forward by `minutes` (only Date is faked).
function advanceMinutes(minutes: number) {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.now() + minutes * 60_000);
}

describe('changing the password signs out older sessions', () => {
	const password = 'correct-horse-battery-staple';

	it('US5-Task13 rejects a token issued before a password reset', async () => {
		const email = 'hardening-reset@example.com';
		const id = await signUp(email);
		const oldToken = await tokenIssuedMinutesAgo(id, email, 1);
		const resetToken = await requestResetToken(email);
		await request.post('/password/reset').send({ token: resetToken, newPassword: 'a-brand-new-password' });

		const res = await request.get('/me').set('Authorization', `Bearer ${oldToken}`);
		expect(res.status).toBe(401);
	});

	it('US5-Task13 rejects a token issued before a password change in Settings', async () => {
		const email = 'hardening-change@example.com';
		const id = await signUp(email);
		const oldToken = await tokenIssuedMinutesAgo(id, email, 1);
		await request.post('/password').set('Authorization', `Bearer ${oldToken}`)
			.send({ currentPassword: password, newPassword: 'a-brand-new-password' });

		// The very token that made the change is now signed out.
		const res = await request.get('/me').set('Authorization', `Bearer ${oldToken}`);
		expect(res.status).toBe(401);
	});

	it('US5-Task13 answers POST /password with a new token', async () => {
		const email = 'hardening-new-token@example.com';
		const id = await signUp(email);
		const oldToken = await tokenIssuedMinutesAgo(id, email, 1);

		const res = await request.post('/password').set('Authorization', `Bearer ${oldToken}`)
			.send({ currentPassword: password, newPassword: 'a-brand-new-password' });
		expect(res.body.token).toBeTypeOf('string');
	});

	it('US5-Task13 lets the new token from POST /password reach GET /me', async () => {
		const email = 'hardening-new-token-works@example.com';
		const id = await signUp(email);
		const oldToken = await tokenIssuedMinutesAgo(id, email, 1);
		const change = await request.post('/password').set('Authorization', `Bearer ${oldToken}`)
			.send({ currentPassword: password, newPassword: 'a-brand-new-password' });

		const res = await request.get('/me').set('Authorization', `Bearer ${change.body.token}`);
		expect(res.status).toBe(200);
	});

	it('US5-Task13 still accepts a token issued after the last password change', async () => {
		const email = 'hardening-later-login@example.com';
		const id = await signUp(email);
		const oldToken = await tokenIssuedMinutesAgo(id, email, 1);
		await request.post('/password').set('Authorization', `Bearer ${oldToken}`)
			.send({ currentPassword: password, newPassword: 'a-brand-new-password' });
		// Usually lands in the same second as the change, which must still count as "after".
		const login = await request.post('/login').send({ email, password: 'a-brand-new-password' });

		const res = await request.get('/me').set('Authorization', `Bearer ${login.body.token}`);
		expect(res.status).toBe(200);
	});
});

describe('rate limiting the reset endpoints per IP', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	// Every supertest request comes from the same IP, so these all count together.
	async function postTimes(path: string, body: object, times: number) {
		let res = await request.post(path).send(body);
		for (let i = 1; i < times; i++) res = await request.post(path).send(body);
		return res;
	}

	it('US5-Task13 answers the 6th POST /password/forgot within 15 minutes with 429', async () => {
		fakeMailer();
		// A different address each time, so only the IP limit can be hit.
		for (let i = 0; i < 5; i++) await request.post('/password/forgot').send({ email: `ip-limit-${i}@example.com` });

		const res = await request.post('/password/forgot').send({ email: 'ip-limit-5@example.com' });
		expect(res.status).toBe(429);
	});

	it('US5-Task13 answers the 6th POST /password/reset within 15 minutes with 429', async () => {
		const res = await postTimes('/password/reset', { token: 'f'.repeat(64), newPassword: 'a-brand-new-password' }, 6);
		expect(res.status).toBe(429);
	});

	it('US5-Task13 lets POST /password/forgot work again after 15 minutes', async () => {
		fakeMailer();
		await postTimes('/password/forgot', { email: 'ip-limit-window@example.com' }, 6);
		advanceMinutes(15);

		const res = await request.post('/password/forgot').send({ email: 'ip-limit-window@example.com' });
		expect(res.status).toBe(200);
	});
});

describe('limiting reset emails per address', () => {
	const email = 'address-limit@example.com';

	beforeAll(async () => {
		await signUp(email);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// Asks for a reset link for the address `times` times and returns the last answer.
	async function forgotTimes(times: number) {
		let res = await request.post('/password/forgot').send({ email });
		for (let i = 1; i < times; i++) res = await request.post('/password/forgot').send({ email });
		return res;
	}

	it('US5-Task13 still answers the 4th request for one address within an hour with 200', async () => {
		fakeMailer();
		const res = await forgotTimes(4);
		// The same answer as always, so the limit gives nothing away.
		expect(res.status).toBe(200);
	});

	it('US5-Task13 sends no email for the 4th request for one address within an hour', async () => {
		const send = fakeMailer();
		await forgotTimes(4);
		expect(send).toHaveBeenCalledTimes(3);
	});

	it('US5-Task13 sends the email again after the hour passes', async () => {
		const send = fakeMailer();
		await forgotTimes(3);
		advanceMinutes(60);

		await request.post('/password/forgot').send({ email });
		expect(send).toHaveBeenCalledTimes(4);
	});
});

describe('emails do not depend on case or surrounding spaces', () => {
	it('US5-Task13 stores a signed up email in lowercase', async () => {
		const res = await request.post('/signup').send({ email: 'Case-Store@X.com', password: 'correct-horse-battery-staple' });
		expect(res.body.user.email).toBe('case-store@x.com');
	});

	it('US5-Task13 logs in with a differently cased email with spaces around it', async () => {
		await request.post('/signup').send({ email: 'Case-Login@X.com', password: 'correct-horse-battery-staple' });

		const res = await request.post('/login').send({ email: ' case-login@x.com ', password: 'correct-horse-battery-staple' });
		expect(res.status).toBe(200);
	});

	it('US5-Task13 refuses to sign up an email that differs only by case', async () => {
		await request.post('/signup').send({ email: 'Case-Dup@x.com', password: 'correct-horse-battery-staple' });

		const res = await request.post('/signup').send({ email: 'case-dup@x.com', password: 'correct-horse-battery-staple' });
		expect(res.status).toBe(409);
	});

	it('US5-Task13 sends the reset email for a differently cased email to the account', async () => {
		await request.post('/signup').send({ email: 'case-forgot@x.com', password: 'correct-horse-battery-staple' });
		const send = fakeMailer();

		await request.post('/password/forgot').send({ email: 'CASE-FORGOT@x.com' });
		// The first argument of the mailer is the address the email goes to.
		expect(send.mock.calls[0][0]).toBe('case-forgot@x.com');
	});
});
