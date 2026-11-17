import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from './db';

export const GAME_DURATION_MS = 20 * 60 * 1000;
const CODE_SERVICE_URL = process.env.CODE_SERVICE_URL ?? 'http://localhost:4001';

const readyPlayerSchema = z.object({
	userId: z.uuid(),
	displayName: z.string().trim().min(1).max(24),
	team: z.enum(['a', 'b']),
});

// The lobby host picks 1v1, 2v2 or 3v3, so a match is 2 to 6 players with
// the same number on each team.
const startGameBodySchema = z.object({
	players: z.array(readyPlayerSchema).min(2).max(6),
}).refine(
	(body) => body.players.filter((player) => player.team === 'a').length * 2 === body.players.length,
	{ message: 'players must be split evenly across team a and team b' },
);

export type TeamId = 'a' | 'b';

export interface GamePlayerState {
	userId: string;
	displayName: string;
	team: TeamId;
	connected: boolean;
}

export interface GameState {
	gameId: string;
	startedAt: number; // Date.now() at creation; used to compute time remaining
	endTimer: NodeJS.Timeout; // server-side authority for ending the match - see scheduleGameEnd
	scores: Record<TeamId, number>; // live counterpart of game.t1_score / t2_score
	players: Map<string, GamePlayerState>; // keyed by userId
	problemPool: string[]; // task_ids assigned to this game (game_problems)
	selections: Map<string, string>; // userId -> task_id currently being worked (player_selections)
}

const games = new Map<string, GameState>();

// The live state for a game this process started, if it is still running.
export function findGame(gameId: string): GameState | undefined {
	return games.get(gameId);
}

// The wire form of a GameState for the `game:state` socket event: everything
// a client needs to render the match, minus the server-only end timer.
export function serializeGame(game: GameState) {
	return {
		gameId: game.gameId,
		startedAt: game.startedAt,
		secondsRemaining: Math.max(0, Math.ceil((game.startedAt + GAME_DURATION_MS - Date.now()) / 1000)),
		scores: game.scores,
		problemPool: game.problemPool,
		players: [...game.players.values()],
	};
}

class HttpError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

// The shared problem pool for a new match: six Easy + three Medium questions
// from CodeService's GET /problem?difficulty=&quantity= endpoint. Both teams
// draw from the same nine (see game_problems in sql/schema.sql).
// Any failure here (an error status, or CodeService not answering at all)
// becomes a 502, since it's an upstream problem rather than a bad request.
async function fetchProblemPool(): Promise<string[]> {
	const unavailable = new HttpError(502, 'could not load the problem pool from CodeService');
	// The fetch Response, not Express's Response imported at the top of this file.
	let responses: globalThis.Response[];
	try {
		responses = await Promise.all([
			fetch(`${CODE_SERVICE_URL}/problem?difficulty=Easy&quantity=6`),
			fetch(`${CODE_SERVICE_URL}/problem?difficulty=Medium&quantity=3`),
		]);
	} catch {
		throw unavailable;
	}
	if (responses.some((response) => !response.ok)) throw unavailable;
	const [easyProblems, mediumProblems] = await Promise.all(
		responses.map((response) => response.json() as Promise<{ task_id: string }[]>),
	);
	return [...easyProblems, ...mediumProblems].map((problem) => problem.task_id);
}

// Saves the game, its players, their teams and its problem pool in one
// statement. Postgres applies a statement all-or-nothing, so if any part
// fails (e.g. the same player listed twice) no half-made game is left behind.
// The foreign keys between these tables are checked at the end of the
// statement, so writing parent and child rows together is allowed.
const SAVE_GAME_SQL = `
	WITH new_game AS (
		INSERT INTO game DEFAULT VALUES RETURNING game_id
	), roster AS (
		SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[]) AS r(user_id, display_name, team)
	), new_players AS (
		INSERT INTO players (game_id, user_id, display_name)
		SELECT new_game.game_id, roster.user_id, roster.display_name FROM new_game, roster
	), new_teams AS (
		INSERT INTO player_teams (game_id, user_id, team)
		SELECT new_game.game_id, roster.user_id, roster.team FROM new_game, roster
	), new_problems AS (
		INSERT INTO game_problems (game_id, task_id)
		SELECT new_game.game_id, pool.task_id FROM new_game, unnest($4::text[]) AS pool(task_id)
	)
	SELECT game_id FROM new_game`;

export function getRoot(_req: Request, res: Response) {
	res.json({
		service: 'game-service',
		message: 'Hello from game-service',
	});
}

// Called once LobbyService's countdown fires (lobby:ready-for-match). Takes the
// ready players (1v1 to 3v3) + their teams, and:
//   - picks the shared problem pool from CodeService first, so nothing is
//     saved if that fails
//   - INSERTs the `game` row (started_at defaults to NOW(), ended_at stays null),
//     matching `players` / `player_teams` rows and `game_problems`, all in one
//     statement (see SAVE_GAME_SQL)
//   - creates the in-memory GameState for this game_id (scores, timer, picks)
//     and starts the match-duration timer (see scheduleGameEnd)
// Responds with { gameId } so the frontend can navigate to /game/[gameId].
export async function createGame(req: Request, res: Response, next: NextFunction) {
	const body = startGameBodySchema.safeParse(req.body);
	if (!body.success) {
		return next(new HttpError(400, 'players must be 2 to 6 entries split evenly across teams a and b'));
	}
	const { players } = body.data;

	try {
		const problemPool = await fetchProblemPool();
		const gameResult = await pool.query<{ game_id: string }>(SAVE_GAME_SQL, [
			players.map((player) => player.userId),
			players.map((player) => player.displayName),
			players.map((player) => player.team),
			problemPool,
		]);
		const gameId = gameResult.rows[0].game_id;

		const endTimer = setTimeout(() => {
			games.delete(gameId);
			void pool.query('UPDATE game SET ended_at = NOW() WHERE game_id = $1', [gameId]).catch((err: unknown) => {
				console.error('[game-service] failed to persist game end', err);
			});
		}, GAME_DURATION_MS);
		endTimer.unref?.();

		games.set(gameId, {
			gameId,
			startedAt: Date.now(),
			endTimer,
			scores: { a: 0, b: 0 },
			players: new Map(players.map((player) => [player.userId, { ...player, connected: false }])),
			problemPool,
			selections: new Map(),
		});

		res.status(201).json({ gameId });
	} catch (err) {
		next(err);
	}
}

// Fetches a single game's current state for the /game/[gameId] page (initial
// load or reconnect after a dropped socket). Prefers the in-memory GameState
// when this game_id is still live (cheap, has the authoritative scores/picks);
// falls back to a DB read (game + players + player_teams + submissions) once
// ended_at is set and the in-memory state has been torn down.
export async function getGame(req: Request, res: Response, next: NextFunction) {
	const { id: userId } = req.params;
	try {
		const result = await pool.query<{ game_id: string }>(
			`SELECT game.game_id FROM game
			 JOIN players ON players.game_id = game.game_id
			 WHERE players.user_id = $1 AND game.ended_at IS NULL
			 ORDER BY game.started_at ASC
			 LIMIT 1`,
			[userId],
		);
		if (result.rows.length === 0) {
			return next(new HttpError(404, 'no active game for that player'));
		}
		res.json({ gameId: result.rows[0].game_id });
	} catch (err) {
		next(err);
	}
}

// Invoked when CodeService reports a scored submission for a player in an
// active game. Inserts a `submissions` row, recomputes that team's score from
// the submission's points_awarded, and updates both the in-memory GameState
// and the `game.t1_score` / `t2_score` cache columns so they can't drift.
// Also broadcasts the new score to the game's socket.io room.
// export async function recordSubmission(req: Request, res: Response, next: NextFunction) {}

// Updates `player_selections` when a player switches which problem they're
// working on. Upserts the one active row per (game_id, user_id).
// export async function selectProblem(req: Request, res: Response, next: NextFunction) {}

// Not an HTTP handler - called by the per-game setTimeout started in
// createGame (mirrors LobbyService's countdown pattern: server-side timer is
// the sole authority, never trusted to a client). Sets `ended_at`, persists
// final scores, tears down the in-memory GameState/timer for this game_id,
// and emits a final "game:ended" event to the game's socket.io room.
// async function scheduleGameEnd(gameId: string) {}
