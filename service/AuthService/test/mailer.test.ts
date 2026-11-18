// US5-Task11 (#96). Pseudocode: test/mailer-test-pseudo.md
// The reset email is sent through Brevo's HTTP API with the built-in fetch.
// fetch is replaced with a fake in every test, so Brevo is never called, and
// the environment (BREVO_API_KEY, MAIL_FROM) is stubbed per test.
// These tests exercise the mailer on its own, so no database is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailer } from '../src/utils/mailer';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const API_KEY = 'test-brevo-key';
const FROM = 'leetbattle@example.com';
const TO = 'ada@example.com';
const LINK = 'http://localhost:3000/login/reset?token=abc123';

// A fake fetch that answers like Brevo does when it accepts an email (201).
function fakeFetch(status = 201) {
	const fetch = vi.fn().mockResolvedValue(new Response('{}', { status }));
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

// The [url, init] that sendPasswordReset passed to fetch.
function sentRequest(fetch: ReturnType<typeof fakeFetch>): [string, RequestInit] {
	return fetch.mock.calls[0] as [string, RequestInit];
}

// The JSON body sent to Brevo, parsed.
function sentBody(fetch: ReturnType<typeof fakeFetch>) {
	return JSON.parse(String(sentRequest(fetch)[1].body));
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe('sending the reset email with a Brevo key', () => {
	beforeEach(() => {
		vi.stubEnv('BREVO_API_KEY', API_KEY);
		vi.stubEnv('MAIL_FROM', FROM);
	});

	it('US5-Task11 posts to Brevo\'s send email endpoint', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		expect(sentRequest(fetch)[0]).toBe(BREVO_SEND_URL);
	});

	it('US5-Task11 sends the Brevo key in the "api-key" header', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		const headers = new Headers(sentRequest(fetch)[1].headers);
		expect(headers.get('api-key')).toBe(API_KEY);
	});

	it('US5-Task11 sends the email to the address it was given', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		// Brevo takes a list of recipients; the reset email has exactly one.
		expect(sentBody(fetch).to).toEqual([{ email: TO }]);
	});

	it('US5-Task11 sends the email from the MAIL_FROM address', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		expect(sentBody(fetch).sender.email).toBe(FROM);
	});

	it('US5-Task11 puts the reset link in the email', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		// The plain-text part is checked; the HTML part carries the same text.
		expect(sentBody(fetch).textContent).toContain(LINK);
	});

	it('US5-Task11 says the link works for 30 minutes', async () => {
		const fetch = fakeFetch();
		await mailer.sendPasswordReset(TO, LINK);
		expect(sentBody(fetch).textContent).toContain('30 minutes');
	});

	it('US5-Task11 throws when Brevo refuses the email', async () => {
		// Brevo answers 4xx for a bad key or an unverified sender.
		fakeFetch(401);
		await expect(mailer.sendPasswordReset(TO, LINK)).rejects.toThrow();
	});

	it('US5-Task11 does not write the reset link to the log', async () => {
		fakeFetch();
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await mailer.sendPasswordReset(TO, LINK);
		// The link is a working credential for 30 minutes, so once it is
		// emailed it must not also end up in the service's logs.
		expect(log.mock.calls.flat().join(' ')).not.toContain(LINK);
	});
});

describe('without a Brevo key (local development)', () => {
	beforeEach(() => {
		vi.stubEnv('BREVO_API_KEY', '');
	});

	it('US5-Task11 writes the reset link to the log', async () => {
		fakeFetch();
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await mailer.sendPasswordReset(TO, LINK);
		expect(log.mock.calls.flat().join(' ')).toContain(LINK);
	});

	it('US5-Task11 sends nothing to Brevo', async () => {
		const fetch = fakeFetch();
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await mailer.sendPasswordReset(TO, LINK);
		expect(fetch).not.toHaveBeenCalled();
	});
});
