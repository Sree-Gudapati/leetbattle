// US-6-T-2: GameService socket should require authentication
//  - Connections without a valid login token should be rejected with "unauthorized"
//  - A logged-in user who is not a player in the game should be rejected with "not-in-game"
//  - A connection for a gameId that does not exist should be rejected with "not-in-game"
// GameService socket should send the game state to a player who joins
//  - The "game:state" event should carry the gameId the player connected to
//  - The game state should list all six players
//  - The game state should list the nine problems in the match pool
//  - The joining player should be shown as connected
//  - The game state should include how many seconds remain in the match
// GameService socket should put each player in their team's room
//  - A player on team a should be in the "game:<gameId>:a" room
//  - A player on team a should not be in the "game:<gameId>:b" room
// GameService socket should keep every player's connection status up to date
//  - When a second player joins, players already connected should receive a game state showing two connected players
//  - When a player's socket drops, the remaining players should receive a game state showing that player as disconnected
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EncryptJWT } from 'jose';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { gameServer, request, socketUrl } from './setup';
import { fakeCodeServiceFetch, sixReadyPlayers } from './fixtures';
import type { ReadyPlayer } from './fixtures';

// Mirrors the JWE session tokens AuthService issues (see LobbyService's auth
// tests): encrypted with the shared SECRET, carrying the account's id/email.
const SECRET = 'local-test-secret-'.padEnd(64, 'x');
const MATCH_SECONDS = 20 * 60;

// The payload GameService sends on `game:state`.
interface GameStatePayload {
	gameId: string;
	secondsRemaining: number;
	problemPool: string[];
	players: { userId: string; team: 'a' | 'b'; connected: boolean }[];
}

let clients: Socket[] = [];
let players: ReadyPlayer[];
let gameId: string;

async function tokenFor(userId: string): Promise<string> {
	return new EncryptJWT({ id: userId, email: `${userId}@example.test` })
		.setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
		.setIssuedAt()
		.setExpirationTime('5m')
		.encrypt(new TextEncoder().encode(SECRET));
}

// Resolves with the next `game:state` that satisfies `predicate`, so a test
// can wait for a specific roster change rather than whichever state arrives first.
function nextState(socket: Socket, predicate: (_state: GameStatePayload) => boolean = () => true): Promise<GameStatePayload> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.off('game:state', onState);
			reject(new Error('Timed out waiting for the expected game state'));
		}, 2_000);
		const onState = (state: GameStatePayload) => {
			if (!predicate(state)) return;
			clearTimeout(timeout);
			socket.off('game:state', onState);
			resolve(state);
		};
		socket.on('game:state', onState);
	});
}

// Opens a socket with the given handshake auth but does not connect it yet.
function openSocket(auth: Record<string, unknown>): Socket {
	const client = io(socketUrl(), {
		autoConnect: false,
		reconnection: false,
		transports: ['websocket'],
		auth,
	});
	clients.push(client);
	return client;
}

// Connects with the given auth and resolves with the reason the server refused it.
function connectionError(auth: Record<string, unknown>): Promise<Error> {
	const client = openSocket(auth);
	const error = new Promise<Error>((resolve) => client.once('connect_error', resolve));
	client.connect();
	return error;
}

// Connects `userId` to the game under test and resolves once the server has
// sent them their first `game:state`.
async function joinGame(userId: string, gameIdToJoin = gameId): Promise<{ socket: Socket; state: GameStatePayload }> {
	const socket = openSocket({ token: await tokenFor(userId), gameId: gameIdToJoin });
	const state = nextState(socket);
	socket.connect();
	return { socket, state: await state };
}

// Waits until the server has processed every client disconnect, so one test's
// sockets are out of their rooms before the next test counts room members.
async function waitForServerSockets(count: number): Promise<void> {
	const deadline = Date.now() + 2_000;
	while (gameServer.io.sockets.sockets.size !== count) {
		if (Date.now() > deadline) throw new Error('Timed out waiting for sockets to close');
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

beforeAll(async () => {
	process.env.SECRET = SECRET;
	vi.stubGlobal('fetch', fakeCodeServiceFetch());
	players = sixReadyPlayers();
	const res = await request.put('/game').send({ players });
	gameId = res.body.gameId;
});

afterEach(async () => {
	for (const client of clients) client.disconnect();
	clients = [];
	await waitForServerSockets(0);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

describe('game socket authentication', () => {
	it('rejects a connection without a valid login token', async () => {
		const error = await connectionError({ token: 'invalid-token', gameId });
		expect(error.message).toBe('unauthorized');
	});

	it('rejects a logged-in user who is not a player in the game', async () => {
		const error = await connectionError({ token: await tokenFor(randomUUID()), gameId });
		expect(error.message).toBe('not-in-game');
	});

	it('rejects a connection for a game that does not exist', async () => {
		const error = await connectionError({ token: await tokenFor(players[0].userId), gameId: randomUUID() });
		expect(error.message).toBe('not-in-game');
	});
});

describe('game state on join', () => {
	it('carries the gameId the player connected to', async () => {
		const { state } = await joinGame(players[0].userId);
		expect(state.gameId).toBe(gameId);
	});

	it('lists all six players', async () => {
		const { state } = await joinGame(players[0].userId);
		expect(state.players).toHaveLength(6);
	});

	it('lists the nine problems in the match pool', async () => {
		const { state } = await joinGame(players[0].userId);
		expect(state.problemPool).toHaveLength(9);
	});

	it('shows the joining player as connected', async () => {
		const { state } = await joinGame(players[0].userId);
		expect(state.players.find((player) => player.userId === players[0].userId)?.connected).toBe(true);
	});

	it('includes the seconds remaining in the match', async () => {
		const { state } = await joinGame(players[0].userId);
		// The game was created moments ago, so nearly the whole 20 minutes is left.
		expect(state.secondsRemaining > 0 && state.secondsRemaining <= MATCH_SECONDS).toBe(true);
	});
});

describe('team rooms', () => {
	it('puts a team a player in their team room', async () => {
		await joinGame(players[0].userId);
		const members = await gameServer.io.in(`game:${gameId}:a`).fetchSockets();
		expect(members.map((member) => member.data.user.id)).toEqual([players[0].userId]);
	});

	it('keeps a team a player out of team b\'s room', async () => {
		await joinGame(players[0].userId);
		const members = await gameServer.io.in(`game:${gameId}:b`).fetchSockets();
		expect(members).toHaveLength(0);
	});
});

describe('connection status', () => {
	it('tells connected players when a teammate joins', async () => {
		const first = await joinGame(players[0].userId);
		const twoConnected = nextState(first.socket, (state) => state.players.filter((player) => player.connected).length === 2);
		await joinGame(players[1].userId);
		const state = await twoConnected;
		expect(state.players.filter((player) => player.connected).map((player) => player.userId).sort())
			.toEqual([players[0].userId, players[1].userId].sort());
	});

	it('marks a player disconnected when their socket drops', async () => {
		const first = await joinGame(players[0].userId);
		const second = await joinGame(players[1].userId);
		const dropped = nextState(first.socket, (state) =>
			state.players.some((player) => player.userId === players[1].userId && !player.connected));
		second.socket.disconnect();
		const state = await dropped;
		expect(state.players.find((player) => player.userId === players[1].userId)?.connected).toBe(false);
	});
});
