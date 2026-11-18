// US-6-T-8 GET /game/:id should only answer for the logged-in player
//  - A request with no Authorization header should return 401
//  - A request with an invalid token should return 401
//  - A request for another player's id should return 403
//  - A request for another player's id should not include a gameId in the response body
// US-6-T-8 GET /game/:id should tell the player how to rejoin their active match
//  - A request for the token's own user with an active match should return 200
//  - The response should include the gameId of the player's active match
//  - The response should include the GameService WebSocket URL as socketUrl
//  - The response should include "/game/<gameId>" as gameRoute
//  - A request for the token's own user with no active match should return 404
//  - When the player has an older match that never ended but GameService is no longer running it, the response should give the gameId of their live match
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { request } from './setup';
import { pool } from '../src/db';
import { TEST_SECRET, fakeCodeServiceFetch, loginTokenFor, sixReadyPlayers } from './fixtures';

// The WebSocket URL GameService is configured to hand out. A value no default
// could produce, so the test proves the configured URL is the one returned.
const SOCKET_URL = 'http://game-socket.example.test';

let gameId: string;
let playerId: string;
let otherPlayerId: string;

beforeAll(async () => {
	process.env.SECRET = TEST_SECRET;
	process.env.GAME_SOCKET_URL = SOCKET_URL;
	// Creating a game picks its problems from CodeService; a stand-in answers instead.
	vi.stubGlobal('fetch', fakeCodeServiceFetch());
	const players = sixReadyPlayers();
	[playerId, otherPlayerId] = [players[0].userId, players[1].userId];
	const res = await request.put('/game').send({ players });
	gameId = res.body.gameId;
});

afterAll(() => {
	vi.unstubAllGlobals();
	delete process.env.GAME_SOCKET_URL;
});

// GET /game/:id as the player with `tokenUserId`'s login token.
async function getGameAs(tokenUserId: string, pathUserId: string) {
	return request.get(`/game/${pathUserId}`).set('Authorization', `Bearer ${await loginTokenFor(tokenUserId)}`);
}

describe('US-6-T-8 GET /game/:id only answers for the logged-in player', () => {
	it('US-6-T-8 returns 401 without an Authorization header', async () => {
		const res = await request.get(`/game/${playerId}`);
		expect(res.status).toBe(401);
	});

	it('US-6-T-8 returns 401 for an invalid token', async () => {
		const res = await request.get(`/game/${playerId}`).set('Authorization', 'Bearer not-a-real-token');
		expect(res.status).toBe(401);
	});

	// A teammate in the same match is still someone else: their token can't read this player's match.
	it('US-6-T-8 returns 403 for another player\'s id', async () => {
		const res = await getGameAs(otherPlayerId, playerId);
		expect(res.status).toBe(403);
	});

	it('US-6-T-8 leaves the gameId out of a 403 response', async () => {
		const res = await getGameAs(otherPlayerId, playerId);
		expect(res.body.gameId).toBeUndefined();
	});
});

describe('US-6-T-8 GET /game/:id tells the player how to rejoin', () => {
	it('US-6-T-8 returns 200 for the player\'s own active match', async () => {
		const res = await getGameAs(playerId, playerId);
		expect(res.status).toBe(200);
	});

	it('US-6-T-8 returns the gameId of the player\'s active match', async () => {
		const res = await getGameAs(playerId, playerId);
		expect(res.body.gameId).toBe(gameId);
	});

	it('US-6-T-8 returns the GameService WebSocket URL as socketUrl', async () => {
		const res = await getGameAs(playerId, playerId);
		expect(res.body.socketUrl).toBe(SOCKET_URL);
	});

	it('US-6-T-8 returns /game/<gameId> as gameRoute', async () => {
		const res = await getGameAs(playerId, playerId);
		expect(res.body.gameRoute).toBe(`/game/${gameId}`);
	});

	// A GameService restart (e.g. a deploy) forgets the matches it was running
	// but leaves their rows without an ended_at. Rejoining one of those would be
	// refused, so the lookup has to skip it for the match that is really live.
	it('US-6-T-8 returns the live match, not an older one GameService is no longer running', async () => {
		const players = sixReadyPlayers();
		const leftover = await pool.query<{ game_id: string }>(
			'INSERT INTO game (started_at) VALUES (NOW() - INTERVAL \'1 day\') RETURNING game_id',
		);
		await pool.query(
			'INSERT INTO players (game_id, user_id, display_name) VALUES ($1, $2, $3)',
			[leftover.rows[0].game_id, players[0].userId, players[0].displayName],
		);
		const live = await request.put('/game').send({ players });
		const res = await getGameAs(players[0].userId, players[0].userId);
		expect(res.body.gameId).toBe(live.body.gameId);
	});

	it('US-6-T-8 returns 404 when the player has no active match', async () => {
		const loneUserId = randomUUID();
		const res = await getGameAs(loneUserId, loneUserId);
		expect(res.status).toBe(404);
	});
});
