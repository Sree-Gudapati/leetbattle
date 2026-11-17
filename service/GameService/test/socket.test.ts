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
// Game should wait for its players before the clock starts
//  - A new game should be waiting for players
//  - When every player has connected, the game should start playing
//  - When the join wait runs out, the game should start with whoever has connected
// Game should give a dropped player time to reconnect
//  - Right after a player's socket drops, they should not be marked as left
//  - When a player reconnects within the window, they should not be marked as left
//  - When the window runs out, the player should be marked as left
//  - When every player on a team has left, the other team should win by disconnect
// Players should be able to forfeit as a team
//  - When one of two connected teammates forfeits, the game should keep going with one forfeit vote counted
//  - The same player forfeiting twice should count once
//  - When every connected teammate has forfeited, the other team should win by forfeit
// Game should shut down cleanly once it ends
//  - Once the game ends, the players' sockets should be closed
//  - Once the game ends, connecting to it should be rejected with "not-in-game"
//  - Once the game ends, the players should no longer have an active game
// GameService socket should send enough about each problem for the game page to load it
//  - Each problem in the match pool should carry its task_id
//  - Each problem in the match pool should carry the question_id CodeService looks problems up by
//  - Each problem in the match pool should carry its difficulty
// Players should be able to submit a solution through the game
//  - A correct solution should come back from CodeService as "Accepted"
//  - The code should be graded by CodeService using the problem's question_id
//  - Once a solution is accepted, the game state should show that problem as solved for the submitter's team
//  - A wrong solution should not mark the problem as solved
//  - A problem that isn't in the match pool should be rejected with "unknown-problem"
//  - Submitting before the game has started should be rejected with "not-playing"
//  - When CodeService fails, the submission should be rejected with "grading-failed"
// Teams should not be able to spam submissions
//  - While a teammate's submission is being graded, another submission from the same team should be rejected with "team-busy"
//  - While one team's submission is being graded, the other team should still be able to submit
//  - Right after a team's submission is graded, its next submission should be rejected with "cooldown"
//  - Once the cooldown has passed, the team should be able to submit again
// Game should end once a team solves every problem
//  - When a team has solved every problem in the pool, that team should win with reason "solved"
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncryptJWT } from 'jose';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { gameServer, request, socketUrl } from './setup';
import { FAKE_GRADING_MS, fakeCodeServiceFetch, sixReadyPlayers } from './fixtures';
import type { ReadyPlayer } from './fixtures';

// Mirrors the JWE session tokens AuthService issues (see LobbyService's auth
// tests): encrypted with the shared SECRET, carrying the account's id/email.
const SECRET = 'local-test-secret-'.padEnd(64, 'x');
const MATCH_SECONDS = 20 * 60;

// The payload GameService sends on `game:state`.
interface GameStatePayload {
	gameId: string;
	phase: 'waiting' | 'playing';
	secondsRemaining: number;
	problemPool: { taskId: string; questionId: number; difficulty: string }[];
	solved: Record<'a' | 'b', string[]>; // task_ids each team has solved
	players: { userId: string; team: 'a' | 'b'; connected: boolean; left: boolean }[];
	forfeitVotes: Record<'a' | 'b', number>;
}

// The payload GameService sends on `game:ended`.
interface GameResult {
	winner: 'a' | 'b' | null;
	reason: 'forfeit' | 'disconnect' | 'time' | 'solved';
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

// Creates a fresh game with `teamA` players on team a and `teamB` on team b.
async function newGame(teamA: number, teamB: number): Promise<{ gameId: string; players: ReadyPlayer[] }> {
	const roster = sixReadyPlayers().slice(0, teamA + teamB)
		.map((player, i) => ({ ...player, team: (i < teamA ? 'a' : 'b') as 'a' | 'b' }));
	const res = await request.put('/game').send({ players: roster });
	return { gameId: res.body.gameId, players: roster };
}

// Connects every listed player to the game and resolves once it is playing.
async function joinAll(game: { gameId: string; players: ReadyPlayer[] }): Promise<Socket[]> {
	const sockets: Socket[] = [];
	for (const player of game.players) sockets.push((await joinGame(player.userId, game.gameId)).socket);
	return sockets;
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

// The stand-in for CodeService, kept so tests can check what was sent to it.
let codeService: ReturnType<typeof fakeCodeServiceFetch>;

beforeAll(() => {
	process.env.SECRET = SECRET;
	codeService = fakeCodeServiceFetch();
	vi.stubGlobal('fetch', codeService);
});

// A fresh six-player game per test, since the lifecycle tests end theirs.
beforeEach(async () => {
	({ gameId, players } = await newGame(3, 3));
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

// Matches the join wait and reconnect window test/setup.ts gives the server.
const SETUP_WAIT_MS = 300;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('waiting for players', () => {
	it('starts a new game waiting for players', async () => {
		const { state } = await joinGame(players[0].userId);
		expect(state.phase).toBe('waiting');
	});

	it('starts playing once every player has connected', async () => {
		const game = await newGame(1, 1);
		const first = await joinGame(game.players[0].userId, game.gameId);
		const playing = nextState(first.socket, (state) => state.phase === 'playing');
		await joinGame(game.players[1].userId, game.gameId);
		expect((await playing).phase).toBe('playing');
	});

	it('starts with whoever has connected when the join wait runs out', async () => {
		const game = await newGame(1, 1);
		const first = await joinGame(game.players[0].userId, game.gameId);
		const state = await nextState(first.socket, (next) => next.phase === 'playing');
		expect(state.players.filter((player) => player.connected)).toHaveLength(1);
	});
});

describe('reconnect window', () => {
	it('does not mark a player as left right after their socket drops', async () => {
		const first = await joinGame(players[0].userId);
		const second = await joinGame(players[1].userId);
		const dropped = nextState(first.socket, (state) => state.players.some((player) => player.userId === players[1].userId && !player.connected));
		second.socket.disconnect();
		const state = await dropped;
		expect(state.players.find((player) => player.userId === players[1].userId)?.left).toBe(false);
	});

	it('does not mark a player who reconnects in time as left', async () => {
		// Everyone connects, so no one else's window runs out during the pause.
		const game = await newGame(2, 2);
		const [first, second, third] = await joinAll(game);
		const reconnecting = game.players[1].userId;
		second.disconnect();
		await joinGame(reconnecting, game.gameId);
		await pause(SETUP_WAIT_MS * 2);
		// Another player dropping brings a fresh state with everyone's status.
		const update = nextState(first, (state) => state.players.some((player) => player.userId === game.players[2].userId && !player.connected));
		third.disconnect();
		const state = await update;
		expect(state.players.find((player) => player.userId === reconnecting)?.left).toBe(false);
	});

	it('marks a player as left when the window runs out', async () => {
		const first = await joinGame(players[0].userId);
		const second = await joinGame(players[1].userId);
		const left = nextState(first.socket, (state) => state.players.some((player) => player.userId === players[1].userId && player.left));
		second.socket.disconnect();
		const state = await left;
		expect(state.players.find((player) => player.userId === players[1].userId)?.left).toBe(true);
	});

	it('gives the other team the win by disconnect when a whole team has left', async () => {
		const game = await newGame(1, 1);
		const [teamA, teamB] = await joinAll(game);
		const ended = nextEvent<GameResult>(teamA, 'game:ended');
		teamB.disconnect();
		expect(await ended).toEqual({ winner: 'a', reason: 'disconnect' });
	});
});

describe('forfeit', () => {
	it('keeps going with one vote counted when one of two teammates forfeits', async () => {
		const game = await newGame(2, 2);
		const [first] = await joinAll(game);
		const voted = nextState(first, (state) => state.forfeitVotes.a === 1);
		first.emit('game:forfeit');
		const state = await voted;
		expect({ phase: state.phase, votes: state.forfeitVotes.a }).toEqual({ phase: 'playing', votes: 1 });
	});

	it('counts the same player forfeiting twice once', async () => {
		const game = await newGame(2, 2);
		const [first] = await joinAll(game);
		const firstVote = nextState(first, (state) => state.forfeitVotes.a === 1);
		first.emit('game:forfeit');
		await firstVote;
		const secondVote = nextState(first);
		first.emit('game:forfeit');
		expect((await secondVote).forfeitVotes.a).toBe(1);
	});

	it('gives the other team the win by forfeit once every connected teammate has forfeited', async () => {
		const game = await newGame(2, 2);
		const [first, second, otherTeam] = await joinAll(game);
		const ended = nextEvent<GameResult>(otherTeam, 'game:ended');
		first.emit('game:forfeit');
		second.emit('game:forfeit');
		expect(await ended).toEqual({ winner: 'b', reason: 'forfeit' });
	});
});

describe('after the game ends', () => {
	// A 1v1 that team a forfeits straight away.
	async function forfeitedGame() {
		const game = await newGame(1, 1);
		const sockets = await joinAll(game);
		const ended = nextEvent<GameResult>(sockets[1], 'game:ended');
		sockets[0].emit('game:forfeit');
		await ended;
		return { game, sockets };
	}

	it('closes the players\' sockets', async () => {
		const { sockets } = await forfeitedGame();
		await pause(50);
		expect(sockets.some((socket) => socket.connected)).toBe(false);
	});

	it('rejects connecting to it with "not-in-game"', async () => {
		const { game } = await forfeitedGame();
		const error = await connectionError({ token: await tokenFor(game.players[0].userId), gameId: game.gameId });
		expect(error.message).toBe('not-in-game');
	});

	it('leaves the players with no active game', async () => {
		const { game } = await forfeitedGame();
		const res = await request.get(`/game/${game.players[0].userId}`);
		expect(res.status).toBe(404);
	});
});

// The game page lists the pool from `game:state` alone, then loads a problem's
// full details from CodeService's GET /problem/:questionId - so each entry has
// to carry the question_id, not just the task_id saved in game_problems.
// fakeCodeServiceFetch (test/fixtures.ts) numbers its problems' question_ids
// from 1 and labels each with the difficulty that was asked for.
describe('problem details in the game state', () => {
	it('gives each problem in the pool its task_id', async () => {
		const { state } = await joinGame(players[0].userId);
		// Every one of the nine entries has a task_id string.
		expect(state.problemPool.filter((problem) => typeof problem.taskId === 'string')).toHaveLength(9);
	});

	it('gives each problem in the pool the question_id CodeService looks it up by', async () => {
		const { state } = await joinGame(players[0].userId);
		// Every one of the nine entries has a numeric question_id.
		expect(state.problemPool.filter((problem) => typeof problem.questionId === 'number')).toHaveLength(9);
	});

	it('gives each problem in the pool its difficulty', async () => {
		const { state } = await joinGame(players[0].userId);
		// The pool is 6 Easy + 3 Medium, so the difficulties show up in that order.
		expect(state.problemPool.map((problem) => problem.difficulty)).toEqual([
			'Easy', 'Easy', 'Easy', 'Easy', 'Easy', 'Easy', 'Medium', 'Medium', 'Medium',
		]);
	});
});

// What GameService answers a `game:submit` with: CodeService's grading, or
// the reason the submission was refused before it reached CodeService.
interface SubmitResponse {
	verdict?: string;
	error?: string;
}

// Sends a solution for `questionId` and resolves with GameService's answer.
// The fake CodeService (test/fixtures.ts) accepts the code "correct", fails
// on "crash", and calls anything else a wrong answer.
function submit(socket: Socket, questionId: number, code: string): Promise<SubmitResponse> {
	return socket.timeout(2_000).emitWithAck('game:submit', { questionId, code });
}

// A game that is already playing, with every player connected, plus its pool.
async function playingGame(teamA: number, teamB: number) {
	const game = await newGame(teamA, teamB);
	const first = await joinGame(game.players[0].userId, game.gameId);
	const others: Socket[] = [];
	for (const player of game.players.slice(1)) others.push((await joinGame(player.userId, game.gameId)).socket);
	return { sockets: [first.socket, ...others], pool: first.state.problemPool };
}

// Long enough for the test server's 100 ms submit cooldown (test/setup.ts) to pass.
const AFTER_COOLDOWN_MS = 150;

describe('submitting a solution', () => {
	it('returns CodeService\'s "Accepted" for a correct solution', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		const response = await submit(sockets[0], pool[0].questionId, 'correct');
		expect(response.verdict).toBe('Accepted');
	});

	it('has CodeService grade the code by the problem\'s question_id', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		await submit(sockets[0], pool[0].questionId, 'correct');
		expect(codeService).toHaveBeenCalledWith(`http://localhost:4001/solution/${pool[0].questionId}`, expect.anything());
	});

	it('shows an accepted problem as solved for the submitter\'s team', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		const solved = nextState(sockets[1], (state) => state.solved.a.length > 0);
		await submit(sockets[0], pool[0].questionId, 'correct');
		expect((await solved).solved.a).toEqual([pool[0].taskId]);
	});

	it('does not mark a problem solved for a wrong solution', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		// GameService sends a fresh state once each submission is graded.
		const graded = nextState(sockets[1]);
		await submit(sockets[0], pool[0].questionId, 'wrong');
		expect((await graded).solved.a).toEqual([]);
	});

	it('rejects a problem that isn\'t in the match pool with "unknown-problem"', async () => {
		const { sockets } = await playingGame(1, 1);
		const response = await submit(sockets[0], -1, 'correct');
		expect(response.error).toBe('unknown-problem');
	});

	it('rejects a submission before the game has started with "not-playing"', async () => {
		// Only one of the two players connects, so the game is still waiting.
		const game = await newGame(1, 1);
		const { socket, state } = await joinGame(game.players[0].userId, game.gameId);
		const response = await submit(socket, state.problemPool[0].questionId, 'correct');
		expect(response.error).toBe('not-playing');
	});

	it('rejects the submission with "grading-failed" when CodeService fails', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		const response = await submit(sockets[0], pool[0].questionId, 'crash');
		expect(response.error).toBe('grading-failed');
	});
});

describe('submission lock and cooldown', () => {
	it('rejects a teammate\'s submission with "team-busy" while one is being graded', async () => {
		const { sockets, pool } = await playingGame(2, 2);
		const first = submit(sockets[0], pool[0].questionId, 'wrong');
		// Well inside the fake CodeService's grading time.
		await pause(FAKE_GRADING_MS / 5);
		const second = await submit(sockets[1], pool[1].questionId, 'wrong');
		await first;
		expect(second.error).toBe('team-busy');
	});

	it('still lets the other team submit while one team\'s submission is being graded', async () => {
		const { sockets, pool } = await playingGame(2, 2);
		const teamA = submit(sockets[0], pool[0].questionId, 'wrong');
		await pause(FAKE_GRADING_MS / 5);
		// sockets[2] is the first player on team b.
		const teamB = await submit(sockets[2], pool[0].questionId, 'wrong');
		await teamA;
		expect(teamB.verdict).toBe('Wrong Answer');
	});

	it('rejects a team\'s next submission with "cooldown" right after one is graded', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		await submit(sockets[0], pool[0].questionId, 'wrong');
		const response = await submit(sockets[0], pool[0].questionId, 'wrong');
		expect(response.error).toBe('cooldown');
	});

	it('lets the team submit again once the cooldown has passed', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		await submit(sockets[0], pool[0].questionId, 'wrong');
		await pause(AFTER_COOLDOWN_MS);
		const response = await submit(sockets[0], pool[0].questionId, 'wrong');
		expect(response.verdict).toBe('Wrong Answer');
	});
});

describe('winning by solving every problem', () => {
	it('gives the win to the team that solves every problem, with reason "solved"', async () => {
		const { sockets, pool } = await playingGame(1, 1);
		// Team a solves all but the last problem, waiting out the cooldown each time.
		for (const problem of pool.slice(0, -1)) {
			await submit(sockets[0], problem.questionId, 'correct');
			await pause(AFTER_COOLDOWN_MS);
		}
		const ended = nextEvent<GameResult>(sockets[1], 'game:ended');
		await submit(sockets[0], pool[pool.length - 1].questionId, 'correct');
		expect(await ended).toEqual({ winner: 'a', reason: 'solved' });
	});
});
