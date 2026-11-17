// US-6-T-2: Lobby socket context should hand players over to the game
//  - A "lobby:game-started" event from the server should expose the new gameId to the page
// Lobby socket context should let players come back to the lobby after a match
//  - After the server closes the lobby socket (the game started), connecting again should open a new socket
//  - After connecting again, the previous match's gameId should no longer be exposed
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { fakeUser } from './helpers';

// socket.io-client is replaced with a fake that records each socket it hands
// out and lets a test fire server events by hand, so nothing here opens a
// real network connection.
const socketMocks = vi.hoisted(() => ({
	io: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => socketMocks.io(...args) }));
vi.mock('../app/login/context', () => ({ useAuth: () => ({ user: fakeUser, isLoading: false }) }));

import { LobbySocketProvider, useLobbySocket } from '../app/lobby/socket-context';

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

// Exposes the context's connect function to the test, and prints the gameId it holds.
let connectLobby: () => unknown = () => undefined;

function Consumer() {
	const { connect, gameStarted } = useLobbySocket();
	useEffect(() => {
		connectLobby = connect;
		connect();
	}, [connect]);
	return <span data-testid="game-id">{gameStarted?.gameId ?? ''}</span>;
}

function renderConsumer() {
	return render(
		<LobbySocketProvider>
			<Consumer />
		</LobbySocketProvider>,
	);
}

let sockets: ReturnType<typeof fakeSocket>[];

beforeEach(() => {
	vi.clearAllMocks();
	sockets = [];
	socketMocks.io.mockImplementation(() => {
		const fake = fakeSocket();
		sockets.push(fake);
		return fake.socket;
	});
	// getToken() reads the cached session token from localStorage.
	localStorage.setItem('authToken', 'token-1');
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

// The server announces the match, then closes the lobby socket, as LobbyService does.
function startGame(gameId: string) {
	act(() => {
		sockets[0].fire('lobby:game-started', { gameId });
		sockets[0].fire('disconnect', 'io server disconnect');
	});
}

describe('lobby socket context game handoff', () => {
	it('US-6-T-2 exposes the gameId from lobby:game-started', () => {
		renderConsumer();

		act(() => sockets[0].fire('lobby:game-started', { gameId: 'game-1' }));

		expect(screen.getByTestId('game-id').textContent).toBe('game-1');
	});

	it('US-6-T-2 opens a new socket when connecting again after the server closed the lobby socket', () => {
		renderConsumer();
		startGame('game-1');

		act(() => {
			connectLobby();
		});

		expect(sockets).toHaveLength(2);
	});

	it('US-6-T-2 forgets the previous match\'s gameId after connecting again', () => {
		renderConsumer();
		startGame('game-1');

		act(() => {
			connectLobby();
		});

		expect(screen.getByTestId('game-id').textContent).toBe('');
	});
});
