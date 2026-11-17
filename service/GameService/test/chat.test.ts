// US-3-T-2: team chat over the GameService socket
// All tests use a fresh game with at least two players on each team.
// All players must be confirmed to be connected to the GameService before
// running any tests, and no team is marked as left.
//
// GameService should deliver a team chat message to the sender's team
//  - A player's "chat:send" should be delivered as a "chat:message" to every connected teammate
//  - The sender should receive their own "chat:message"
//  - A "chat:message" should carry the message id, sender's user id, display name, team, text and sent time
//  - A player on the other team should not receive the "chat:message"
//
// GameService should limit message text
//  - A "chat:send" with no more than 500 characters should be delivered
//  - A "chat:send" with text longer than 500 characters should not send "chat:message"
//
// The rest of chat-test-pseudo.md is added one test at a time.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncryptJWT } from 'jose';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { gameServer, request, socketUrl } from './setup';
import { fakeCodeServiceFetch, sixReadyPlayers } from './fixtures';
import type { ReadyPlayer } from './fixtures';

// Mirrors the JWE session tokens AuthService issues (same as socket.test.ts):
// encrypted with the shared SECRET, carrying the account's id/email.
const SECRET = 'local-test-secret-'.padEnd(64, 'x');

// The payload GameService sends on `chat:message` (see the US-3-T-2 spec).
interface ChatMessage {
	id: string;
	userId: string;
	displayName: string;
	team: 'a' | 'b';
	text: string;
	sentAt: string;
}

let clients: Socket[] = [];
let players: ReadyPlayer[];
let gameId: string;
// Every player's socket, in roster order: 0-2 are team a, 3-5 are team b.
let sockets: Socket[];

async function tokenFor(userId: string): Promise<string> {
	return new EncryptJWT({ id: userId, email: `${userId}@example.test` })
		.setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
		.setIssuedAt()
		.setExpirationTime('5m')
		.encrypt(new TextEncoder().encode(SECRET));
}

// Resolves with the next `event` the socket receives.
function nextEvent<T>(socket: Socket, event: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2_000);
		socket.once(event, (value: T) => {
			clearTimeout(timeout);
			resolve(value);
		});
	});
}

// Connects `userId` to `gameIdToJoin` and resolves once the server has sent
// their first `game:state`, i.e. once they are in their game and team rooms.
async function joinGame(userId: string, gameIdToJoin: string): Promise<Socket> {
	const socket = io(socketUrl(), {
		autoConnect: false,
		reconnection: false,
		transports: ['websocket'],
		auth: { token: await tokenFor(userId), gameId: gameIdToJoin },
	});
	clients.push(socket);
	const joined = nextEvent(socket, 'game:state');
	socket.connect();
	await joined;
	return socket;
}

// Waits until the server has processed every client disconnect, so one
// test's sockets are gone before the next test starts.
async function waitForServerSockets(count: number): Promise<void> {
	const deadline = Date.now() + 2_000;
	while (gameServer.io.sockets.sockets.size !== count) {
		if (Date.now() > deadline) throw new Error('Timed out waiting for sockets to close');
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

beforeAll(() => {
	process.env.SECRET = SECRET;
	// Creating a game asks CodeService for problems; stand in for it.
	vi.stubGlobal('fetch', fakeCodeServiceFetch());
});

// A fresh 3v3 game per test with every player connected.
beforeEach(async () => {
	players = sixReadyPlayers();
	const res = await request.put('/game').send({ players });
	gameId = res.body.gameId;
	sockets = [];
	for (const player of players) sockets.push(await joinGame(player.userId, gameId));
});

afterEach(async () => {
	for (const client of clients) client.disconnect();
	clients = [];
	await waitForServerSockets(0);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

describe('team chat delivery', () => {
	it('delivers a chat:send as a chat:message to every connected teammate', async () => {
		// Player 0 (team a) sends; players 1 and 2 are their teammates.
		const teammates = [nextEvent<ChatMessage>(sockets[1], 'chat:message'), nextEvent<ChatMessage>(sockets[2], 'chat:message')];
		sockets[0].emit('chat:send', { text: 'hello team' });
		const received = await Promise.all(teammates);
		expect(received.map((message) => message.text)).toEqual(['hello team', 'hello team']);
	});

	it('sends the sender their own chat:message', async () => {
		const own = nextEvent<ChatMessage>(sockets[0], 'chat:message');
		sockets[0].emit('chat:send', { text: 'hello team' });
		expect((await own).text).toBe('hello team');
	});

	it('sends the message id, sender\'s user id, display name, team, text and sent time on chat:message', async () => {
		const received = nextEvent<ChatMessage>(sockets[1], 'chat:message');
		sockets[0].emit('chat:send', { text: 'hello team' });
		// The id and sent time are made by the server, so only their type is known here.
		expect(await received).toEqual({
			id: expect.any(String),
			userId: players[0].userId,
			displayName: players[0].displayName,
			team: 'a',
			text: 'hello team',
			sentAt: expect.any(String),
		});
	});

	it('does not deliver a chat:message to a player on the other team', async () => {
		// Player 3 is on team b; record anything they receive.
		const otherTeam: ChatMessage[] = [];
		sockets[3].on('chat:message', (message: ChatMessage) => otherTeam.push(message));
		const teammate = nextEvent<ChatMessage>(sockets[1], 'chat:message');
		sockets[0].emit('chat:send', { text: 'hello team' });
		// Once the teammate has the message, give the other team the same time
		// again to receive one if it was (wrongly) sent to them too.
		await teammate;
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(otherTeam).toEqual([]);
	});
});

describe('team chat message length', () => {
	it('delivers a chat:send with no more than 500 characters', async () => {
		const longest = 'a'.repeat(500);
		const teammate = nextEvent<ChatMessage>(sockets[1], 'chat:message');
		sockets[0].emit('chat:send', { text: longest });
		expect((await teammate).text).toBe(longest);
	});

	it('does not send a chat:message for a chat:send longer than 500 characters', async () => {
		// Record every message the teammate receives.
		const received: string[] = [];
		sockets[1].on('chat:message', (message: ChatMessage) => received.push(message.text));
		sockets[0].emit('chat:send', { text: 'a'.repeat(501) });
		// The server handles one socket's events in order, so once this valid
		// follow-up arrives, the too-long one has already been handled.
		const followUp = nextEvent<ChatMessage>(sockets[1], 'chat:message');
		sockets[0].emit('chat:send', { text: 'follow-up' });
		await followUp;
		expect(received).toEqual(['follow-up']);
	});
});
