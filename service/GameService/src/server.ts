import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { Express } from 'express';
import { authenticateToken } from './auth';
import type { AuthenticatedUser } from './auth';
import { findGame, serializeGame } from './service';
import type { GamePlayerState, GameState } from './service';

interface ServerOptions {
	origins?: string[];
}

// What the auth middleware attaches to every accepted socket.
interface SocketData {
	user: AuthenticatedUser;
	game: GameState;
	player: GamePlayerState;
}

// Wraps the Express app in an HTTP server and attaches the socket.io endpoint
// to it, so one port serves both the REST routes and the live game traffic.
//
// Rooms: every player joins `game:<gameId>` (match-wide events such as scores
// and the end of the game) and `game:<gameId>:<team>` (team-only traffic such
// as the shared editor). The team room is picked server-side from the roster
// the lobby sent, so a client can't choose to listen to the other team.
export function createGameServer(app: Express, options: ServerOptions = {}) {
	const origins = options.origins ?? (process.env.FRONTEND_URL ?? 'http://localhost:3000')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
	const httpServer = createServer(app);
	const io = new Server(httpServer, { cors: { origin: origins, methods: ['GET', 'POST'] } });
	// The live socket id for each player, so a stale connection (e.g. the tab
	// before a refresh) closing doesn't mark a player disconnected after their
	// replacement socket is already up.
	const socketsByPlayer = new Map<string, string>();
	const gameRoom = (game: GameState) => `game:${game.gameId}`;
	const broadcastState = (game: GameState) => io.to(gameRoom(game)).emit('game:state', serializeGame(game));

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
		broadcastState(game);

		socket.on('disconnect', () => {
			if (socketsByPlayer.get(playerKey) !== socket.id) return;
			socketsByPlayer.delete(playerKey);
			player.connected = false;
			broadcastState(game);
		});
	});

	return {
		httpServer,
		io,
		close: () => new Promise<void>((resolve) => {
			io.close(() => resolve());
		}),
	};
}
