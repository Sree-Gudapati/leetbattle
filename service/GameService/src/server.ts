import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { Express } from 'express';
import { authenticateToken } from './auth';
import type { AuthenticatedUser } from './auth';
import { pool } from './db';
import { findGame, forgetGame, GAME_DURATION_MS, gradeSubmission, onGameCreated, serializeGame } from './service';
import type { GamePlayerState, GameState, Grading, TeamId } from './service';

// How long a new game waits for its players before the clock starts anyway.
const DEFAULT_JOIN_WAIT_MS = 5_000;
// How long a dropped player has to reconnect before they count as having left.
const DEFAULT_RECONNECT_GRACE_MS = 30_000;
// How long a team must wait after a submission is graded before submitting
// again, so teams can't spam CodeService's grading functions.
const DEFAULT_SUBMIT_COOLDOWN_MS = 5_000;

interface ServerOptions {
	origins?: string[];
	joinWaitMs?: number;
	reconnectGraceMs?: number;
	submitCooldownMs?: number;
}

// What the auth middleware attaches to every accepted socket.
interface SocketData {
	user: AuthenticatedUser;
	game: GameState;
	player: GamePlayerState;
}

export type EndReason = 'forfeit' | 'disconnect' | 'time' | 'solved';

// What a player sends on `game:submit`.
interface Submission {
	questionId?: unknown;
	code?: unknown;
}

// The answer to `game:submit`: CodeService's grading, or why it was refused.
type SubmitResponse = Grading | { error: 'not-playing' | 'unknown-problem' | 'team-busy' | 'cooldown' | 'grading-failed' };

// Sent once on `game:ended`. winner is null for a draw.
export interface GameResult {
	winner: TeamId | null;
	reason: EndReason;
}

const otherTeam = (team: TeamId): TeamId => (team === 'a' ? 'b' : 'a');

// When the clock runs out, the higher score wins; level scores are a draw.
export function resultOnTime({ a, b }: Record<TeamId, number>): GameResult {
	return { winner: a === b ? null : a > b ? 'a' : 'b', reason: 'time' };
}

// Wraps the Express app in an HTTP server and attaches the socket.io endpoint
// to it, so one port serves both the REST routes and the live game traffic.
//
// Rooms: every player joins `game:<gameId>` (match-wide events such as scores
// and the end of the game) and `game:<gameId>:<team>` (team-only traffic such
// as the shared editor). The team room is picked server-side from the roster
// the lobby sent, so a client can't choose to listen to the other team.
//
// Lifecycle (all server-side timers, never trusted to a client):
//   waiting -> playing  once every player connects, or the join wait runs out
//   playing -> ended    when a whole team has left, a team forfeits, a team
//                       solves every problem, or time runs out
export function createGameServer(app: Express, options: ServerOptions = {}) {
	const origins = options.origins ?? (process.env.FRONTEND_URL ?? 'http://localhost:3000')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	const joinWaitMs = options.joinWaitMs ?? DEFAULT_JOIN_WAIT_MS;
	const reconnectGraceMs = options.reconnectGraceMs ?? DEFAULT_RECONNECT_GRACE_MS;
	const submitCooldownMs = options.submitCooldownMs ?? DEFAULT_SUBMIT_COOLDOWN_MS;
	const httpServer = createServer(app);
	const io = new Server(httpServer, { cors: { origin: origins, methods: ['GET', 'POST'] } });
	// The live socket id for each player, so a stale connection (e.g. the tab
	// before a refresh) closing doesn't mark a player disconnected after their
	// replacement socket is already up.
	const socketsByPlayer = new Map<string, string>();
	const liveGames = new Set<GameState>();
	const gameRoom = (game: GameState) => `game:${game.gameId}`;
	const broadcastState = (game: GameState) => io.to(gameRoom(game)).emit('game:state', serializeGame(game));
	const teamOf = (game: GameState, team: TeamId) => [...game.players.values()].filter((player) => player.team === team);

	const clearTimers = (game: GameState) => {
		clearTimeout(game.timers.join);
		clearTimeout(game.timers.end);
		for (const timer of game.timers.leave.values()) clearTimeout(timer);
		game.timers.leave.clear();
	};

	// Decides the game: persists the end and final scores, tells every player
	// the result, then closes their sockets and forgets the game.
	const endGame = async (game: GameState, result: GameResult) => {
		if (game.phase === 'ended') return;
		game.phase = 'ended';
		clearTimers(game);
		liveGames.delete(game);
		forgetGame(game.gameId);
		try {
			await pool.query(
				'UPDATE game SET ended_at = NOW(), t1_score = $2, t2_score = $3 WHERE game_id = $1',
				[game.gameId, game.scores.a, game.scores.b],
			);
		} catch (err) {
			console.error('[game-service] failed to persist game end', err);
		}
		io.to(gameRoom(game)).emit('game:ended', result);
		io.in(gameRoom(game)).disconnectSockets(true);
	};

	const endOnTime = (game: GameState) => {
		void endGame(game, resultOnTime(game.scores));
	};

	// Starts the player's reconnect window. If it runs out they count as having
	// left, and a team whose players have all left loses.
	const scheduleLeave = (game: GameState, player: GamePlayerState) => {
		clearTimeout(game.timers.leave.get(player.userId));
		const timer = setTimeout(() => {
			game.timers.leave.delete(player.userId);
			player.left = true;
			if (teamOf(game, player.team).every((teammate) => teammate.left)) {
				void endGame(game, { winner: otherTeam(player.team), reason: 'disconnect' });
				return;
			}
			broadcastState(game);
		}, reconnectGraceMs);
		timer.unref?.();
		game.timers.leave.set(player.userId, timer);
	};

	// Starts the clock. Anyone who hasn't connected yet is treated as having
	// just dropped, so they get the same reconnect window.
	const startPlaying = (game: GameState) => {
		if (game.phase !== 'waiting') return;
		clearTimeout(game.timers.join);
		game.phase = 'playing';
		game.startedAt = Date.now();
		game.timers.end = setTimeout(() => endOnTime(game), GAME_DURATION_MS);
		game.timers.end.unref?.();
		for (const player of game.players.values()) {
			if (!player.connected) scheduleLeave(game, player);
		}
		broadcastState(game);
	};

	const stopListening = onGameCreated((game) => {
		liveGames.add(game);
		game.timers.join = setTimeout(() => startPlaying(game), joinWaitMs);
		game.timers.join.unref?.();
	});

	io.use(async (socket, next) => {
		let user: AuthenticatedUser;
		try {
			user = await authenticateToken(socket.handshake.auth?.token);
		} catch {
			return next(new Error('unauthorized'));
		}
		const gameId: unknown = socket.handshake.auth?.gameId;
		const game = typeof gameId === 'string' ? findGame(gameId) : undefined;
		const player = game?.players.get(user.id);
		if (!game || !player) return next(new Error('not-in-game'));
		socket.data = { user, game, player } satisfies SocketData;
		next();
	});

	io.on('connection', async (socket) => {
		const { user, game, player } = socket.data as SocketData;
		const playerKey = `${game.gameId}:${user.id}`;
		socketsByPlayer.set(playerKey, socket.id);
		await socket.join([gameRoom(game), `${gameRoom(game)}:${player.team}`]);
		player.connected = true;
		player.left = false;
		clearTimeout(game.timers.leave.get(user.id));
		game.timers.leave.delete(user.id);
		if (game.phase === 'waiting' && [...game.players.values()].every((entry) => entry.connected)) {
			startPlaying(game);
		} else {
			broadcastState(game);
		}

		// A team forfeits once every teammate still in the game has voted to.
		socket.on('game:forfeit', () => {
			if (game.phase !== 'playing') return;
			const votes = game.forfeitVotes[player.team];
			votes.add(user.id);
			const stillIn = teamOf(game, player.team).filter((teammate) => teammate.connected && !teammate.left);
			if (stillIn.every((teammate) => votes.has(teammate.userId))) {
				void endGame(game, { winner: otherTeam(player.team), reason: 'forfeit' });
				return;
			}
			broadcastState(game);
		});

		// Grades a teammate's solution through CodeService. One submission per
		// team at a time, then a cooldown, so a team can't spam the grader. An
		// accepted solution marks the problem solved for the team, and the first
		// team to solve the whole pool wins. Results that land after the game has
		// ended change nothing, since endGame only runs once.
		socket.on('game:submit', async (submission: Submission, ack: (_response: SubmitResponse) => void) => {
			if (typeof ack !== 'function') return;
			if (game.phase !== 'playing') return ack({ error: 'not-playing' });
			const problem = game.problemPool.find((entry) => entry.questionId === submission?.questionId);
			if (!problem) return ack({ error: 'unknown-problem' });
			const { team } = player;
			if (game.submitting[team]) return ack({ error: 'team-busy' });
			if (Date.now() < game.cooldownUntil[team]) return ack({ error: 'cooldown' });

			game.submitting[team] = true;
			let grading: Grading | null;
			try {
				grading = await gradeSubmission(problem.questionId, String(submission.code ?? ''));
			} catch {
				grading = null;
			} finally {
				game.submitting[team] = false;
				game.cooldownUntil[team] = Date.now() + submitCooldownMs;
			}
			if (!grading) return ack({ error: 'grading-failed' });

			if (grading.verdict === 'Accepted') game.solved[team].add(problem.taskId);
			ack(grading);
			if (game.solved[team].size === game.problemPool.length) {
				void endGame(game, { winner: team, reason: 'solved' });
				return;
			}
			broadcastState(game);
		});

		socket.on('disconnect', () => {
			if (socketsByPlayer.get(playerKey) !== socket.id) return;
			socketsByPlayer.delete(playerKey);
			if (game.phase === 'ended') return;
			player.connected = false;
			if (game.phase === 'playing') scheduleLeave(game, player);
			broadcastState(game);
		});
	});

	return {
		httpServer,
		io,
		close: () => new Promise<void>((resolve) => {
			stopListening();
			for (const game of liveGames) clearTimers(game);
			io.close(() => resolve());
		}),
	};
}
