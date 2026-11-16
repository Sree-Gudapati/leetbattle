import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { request } from './setup';

// Matches the CODE_SERVICE_URL fallback in src/service.ts (CodeService's own
// default port - see service/CodeService/src/index.ts).
const CODE_SERVICE_URL = 'http://localhost:4001';

// Six LobbyPlayer-shaped entries split 3/3 across teams 'a' and 'b', matching
// the payload LobbyService's `lobby:ready-for-match` event sends. Fresh
// random userIds each call, since GameService has no cross-service FK to
// AuthService's users table - any UUID is a valid player for this service.
function sixReadyPlayers() {
	return [0, 1, 2, 3, 4, 5].map((i) => ({
		userId: randomUUID(),
		displayName: `player-${i}`,
		team: i < 3 ? 'a' : 'b',
	}));
}

// Stands in for CodeService's GET /problem?difficulty=&quantity= endpoint.
// Returns a plausible task_id-bearing problem array sized to whatever
// `quantity` the caller asked for, regardless of difficulty, so createGame's
// two calls (6 easy + 3 medium) both resolve with usable rows.
function fakeCodeServiceFetch() {
	return vi.fn((url: string) => {
		const quantity = Number(new URL(url).searchParams.get('quantity') ?? 0);
		const problems = Array.from({ length: quantity }, (_, i) => ({ task_id: `${url}-${i}` }));
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(problems),
		} as Response);
	});
}

// Every test in this file goes through createGame at least once (directly or
// via a beforeAll), and createGame now calls out to CodeService - stub
// global fetch for the whole file (a beforeAll, not beforeEach, so it's
// already in place for the GET /game/:id describe's own beforeAll) so no
// test depends on a running CodeService. Call history is cleared before
// each test so a test only sees the fetch calls it triggered itself.
let codeServiceFetch: Mock;

beforeAll(() => {
	codeServiceFetch = fakeCodeServiceFetch();
	vi.stubGlobal('fetch', codeServiceFetch);
});

beforeEach(() => {
	codeServiceFetch.mockClear();
});

afterAll(() => {
	vi.unstubAllGlobals();
});

describe('health check', () => {
	it('returns 200 on request', async () => {
		const res = await request
			.get('/');
		expect(res.status).toBe(200);
	});
});

// SERVICE TESTS
// PUT game should start a game, taking a request that accepts the
// 6 players with their teams as the body
// PUT game should reject any malformed requests with a 400
// GET game/id should find the first active game ID from the playerID.
// If an active game doesn't exist, return 404

describe('PUT /game', () => {
	it('starts a game for six players split across two teams', async () => {
		const res = await request
			.put('/game')
			.send({ players: sixReadyPlayers() });
		expect(res.status).toBe(201);
	});

	it('returns the new game\'s id', async () => {
		const res = await request
			.put('/game')
			.send({ players: sixReadyPlayers() });
		expect(typeof res.body.gameId).toBe('string');
	});

	it('rejects a request with no body as malformed', async () => {
		// No .send() call at all - players ends up undefined, which must fail
		// whatever validation checks for a six-player, two-team roster.
		const res = await request.put('/game');
		expect(res.status).toBe(400);
	});

	it('rejects a request without exactly six players as malformed', async () => {
		const fivePlayers = sixReadyPlayers().slice(0, 5);
		const res = await request
			.put('/game')
			.send({ players: fivePlayers });
		expect(res.status).toBe(400);
	});

	it('fetches the shared problem pool from CodeService as 6 easy + 3 medium questions', async () => {
		await request
			.put('/game')
			.send({ players: sixReadyPlayers() });
		const calledUrls = codeServiceFetch.mock.calls.map((call) => call[0] as string);
		expect(calledUrls).toEqual([
			`${CODE_SERVICE_URL}/problem?difficulty=Easy&quantity=6`,
			`${CODE_SERVICE_URL}/problem?difficulty=Medium&quantity=3`,
		]);
	});
});

describe('GET /game/:id', () => {
	let activeGameId: string;
	let activePlayerId: string;

	beforeAll(async () => {
		const players = sixReadyPlayers();
		activePlayerId = players[0].userId;
		const res = await request
			.put('/game')
			.send({ players });
		activeGameId = res.body.gameId;
	});

	it('finds the active game for a player who is in one', async () => {
		const res = await request.get(`/game/${activePlayerId}`);
		expect(res.body.gameId).toBe(activeGameId);
	});

	it('returns 404 for a player with no active game', async () => {
		const res = await request.get(`/game/${randomUUID()}`);
		expect(res.status).toBe(404);
	});
});
