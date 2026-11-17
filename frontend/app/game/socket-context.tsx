'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getToken } from '../login/controller';
import { useAuth } from '../login/context';
import type { TeamId } from '../lobby/socket-context';

export interface GamePlayer {
	userId: string;
	displayName: string;
	team: TeamId;
	connected: boolean;
	left: boolean; // didn't reconnect within the window
}

// One problem in the match pool: enough to list it, and its question_id to
// load the full problem from CodeService.
export interface PoolProblem {
	taskId: string;
	questionId: number;
	difficulty: string;
}

// What GameService sends on `game:state`: the whole match, re-sent whenever
// something about it changes (a player connecting or dropping, for now).
export interface GameState {
	gameId: string;
	// waiting: players are still connecting, the clock hasn't started
	phase: 'waiting' | 'playing';
	startedAt: number | null;
	secondsRemaining: number;
	scores: Record<TeamId, number>;
	problemPool: PoolProblem[];
	players: GamePlayer[];
	forfeitVotes: Record<TeamId, number>;
}

// What GameService sends once on `game:ended`. winner is null for a draw.
export interface GameResult {
	winner: TeamId | null;
	reason: 'forfeit' | 'disconnect' | 'time';
}

export interface GameError {
	code: string;
	message: string;
}

interface GameSocketContextValue {
	socket: Socket | null;
	connected: boolean;
	game: GameState | null;
	result: GameResult | null;
	error: GameError | null;
	connect: (_gameId: string) => Socket | null;
	// Votes for the player's team to forfeit; the team forfeits once every
	// connected teammate has voted.
	forfeit: () => void;
	clearError: () => void;
}

const GameSocketContext = createContext<GameSocketContextValue | null>(null);
const GAME_URL = process.env.NEXT_PUBLIC_GAME_URL ?? 'http://localhost:4004';

// What each reason GameService refuses a connection with means to the player.
const REFUSALS: Record<string, string> = {
	unauthorized: 'Your login session is invalid or expired. Log in again.',
	'not-in-game': 'You are not a player in this match.',
};

export function GameSocketProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const [socket, setSocket] = useState<Socket | null>(null);
	const [connected, setConnected] = useState(false);
	const [game, setGame] = useState<GameState | null>(null);
	const [result, setResult] = useState<GameResult | null>(null);
	const [error, setError] = useState<GameError | null>(null);
	const socketRef = useRef<{ gameId: string; socket: Socket } | null>(null);

	// Opens the socket for one match. GameService checks the login token and
	// that this user is on the match's roster before letting the socket in.
	const connect = useCallback((gameId: string) => {
		if (!user) return null;
		if (socketRef.current?.gameId === gameId) return socketRef.current.socket;

		socketRef.current?.socket.disconnect();
		const token = getToken();
		if (!token) {
			setError({ code: 'missing-token', message: 'Log in again to join the match.' });
			return null;
		}

		const nextSocket = io(GAME_URL, { autoConnect: false, auth: { token, gameId } });
		nextSocket.on('game:state', (state: GameState) => {
			setGame(state);
			setError(null);
		});
		nextSocket.on('game:ended', (ended: GameResult) => setResult(ended));
		nextSocket.on('connect_error', (reason: Error) => {
			const refusal = REFUSALS[reason.message];
			setError(refusal
				? { code: reason.message, message: refusal }
				: { code: 'connection-error', message: 'Could not connect to the game service.' });
		});
		nextSocket.on('connect', () => {
			setConnected(true);
			setError(null);
		});
		nextSocket.on('disconnect', () => setConnected(false));
		socketRef.current = { gameId, socket: nextSocket };
		setSocket(nextSocket);
		setConnected(false);
		setGame(null);
		setResult(null);
		nextSocket.connect();
		return nextSocket;
	}, [user]);

	// The provider lives on the game page, so leaving the page closes the socket.
	useEffect(() => () => {
		socketRef.current?.socket.disconnect();
		socketRef.current = null;
	}, []);

	const forfeit = useCallback(() => {
		socketRef.current?.socket.emit('game:forfeit');
	}, []);

	const clearError = useCallback(() => setError(null), []);
	return (
		<GameSocketContext.Provider value={{ socket, connected, game, result, error, connect, forfeit, clearError }}>
			{children}
		</GameSocketContext.Provider>
	);
}

export function useGameSocket(): GameSocketContextValue {
	const context = useContext(GameSocketContext);
	if (!context) throw new Error('useGameSocket must be used within GameSocketProvider');
	return context;
}
