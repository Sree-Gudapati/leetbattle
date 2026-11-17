// US-6-T-2: Game socket context should connect with the player's identity
//  - The socket should be opened with the login token and the gameId in its auth payload
//  - A "game:state" event from the server should be exposed to the page
//  - When the server rejects the connection with "not-in-game", a "not a player in this match" error should be exposed
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { fakeUser } from './helpers';

// socket.io-client is replaced with a fake that records the connection
// options and lets a test fire server events by hand, so nothing here opens
// a real network connection.
const socketMocks = vi.hoisted(() => ({
	io: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => socketMocks.io(...args) }));
vi.mock('../app/login/context', () => ({ useAuth: () => ({ user: fakeUser, isLoading: false }) }));

import { GameSocketProvider, useGameSocket } from '../app/game/socket-context';

type Handler = (_payload: unknown) => void;

// A stand-in for a socket.io-client Socket: `on` records handlers and `fire`
// invokes them the way the real socket would on a server event.
function fakeSocket() {
	const handlers = new Map<string, Handler[]>();
	const socket = {
		connected: false,
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
			return socket;
		}),
		connect: vi.fn(),
		disconnect: vi.fn(),
		emit: vi.fn(),
	};
	const fire = (event: string, payload?: unknown) => {
		for (const handler of handlers.get(event) ?? []) handler(payload);
	};
	return { socket, fire };
}

// A minimal page: joins game-1 on mount and prints what the context exposes.
function Consumer() {
	const { connect, game, error } = useGameSocket();
	useEffect(() => {
		connect('game-1');
	}, [connect]);
	return (
		<div>
			<span data-testid="game-id">{game?.gameId ?? ''}</span>
			<span data-testid="error">{error?.message ?? ''}</span>
		</div>
	);
}

function renderConsumer() {
	return render(
		<GameSocketProvider>
			<Consumer />
		</GameSocketProvider>,
	);
}

let fake: ReturnType<typeof fakeSocket>;

beforeEach(() => {
	vi.clearAllMocks();
	fake = fakeSocket();
	socketMocks.io.mockReturnValue(fake.socket);
	// getToken() reads the cached session token from localStorage.
	localStorage.setItem('authToken', 'token-1');
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('game socket context', () => {
	it('US-6-T-2 opens the socket with the login token and gameId in its auth payload', () => {
		renderConsumer();

		const [, options] = socketMocks.io.mock.calls[0] as [string, { auth: Record<string, unknown> }];
		expect(options.auth).toEqual({ token: 'token-1', gameId: 'game-1' });
	});

	it('US-6-T-2 exposes the game state the server sends', () => {
		renderConsumer();

		act(() => fake.fire('game:state', { gameId: 'game-1', players: [], problemPool: [], scores: { a: 0, b: 0 }, secondsRemaining: 1200, startedAt: 0 }));

		expect(screen.getByTestId('game-id').textContent).toBe('game-1');
	});

	it('US-6-T-2 reports a readable error when the server says the user is not in the game', () => {
		renderConsumer();

		act(() => fake.fire('connect_error', new Error('not-in-game')));

		expect(screen.getByTestId('error').textContent).toBe('You are not a player in this match.');
	});
});
