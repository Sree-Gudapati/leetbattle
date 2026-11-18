// Exercises the real LobbySocketProvider/useLobbySocket listener wiring,
// unlike lobby.test.tsx (which replaces useLobbySocket with a fake context
// object entirely and so never runs the actual socket.on(...) handlers).
//
// This has to live in its own file rather than alongside lobby.test.tsx:
// that file's vi.mock('../app/lobby/socket-context', ...) must stay active
// for every one of its own tests, and Vitest's mock registry isn't a frozen
// binding per consumer at import time - vi.unmock in one test retroactively
// unmocks the module for every other test in that same file too. Keeping
// this in its own file means the mocked/unmocked instances never collide.
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { LobbySocketProvider, useLobbySocket } from '../app/lobby/socket-context';

type SocketListener = () => void;

// A minimal in-memory stand-in for the one socket.io-client socket
// LobbySocketProvider creates per connect() call - just enough to register
// listeners and let the test fire them directly, the same way
// teammate-code-view.test.tsx's socketHarness stands in for Socket.IO.
const socketHarness = vi.hoisted(() => {
	const sockets: { listeners: Map<string, SocketListener[]> }[] = [];
	return {
		io() {
			const socket = {
				listeners: new Map<string, SocketListener[]>(),
				connected: false,
				on(event: string, listener: SocketListener) {
					const list = this.listeners.get(event) ?? [];
					list.push(listener);
					this.listeners.set(event, list);
					return this;
				},
				connect() {
					this.connected = true;
					return this;
				},
				disconnect() {
					this.connected = false;
					return this;
				},
			};
			sockets.push(socket);
			return socket;
		},
		// Invokes server.ts's payload-less `io.to(LOBBY_ROOM).emit('lobby:game-started')`
		// on the most recently created socket - no argument, matching the real server.
		fireLatestGameStarted() {
			const socket = sockets[sockets.length - 1];
			for (const listener of socket?.listeners.get('lobby:game-started') ?? []) listener();
		},
	};
});

vi.mock('socket.io-client', () => ({ io: socketHarness.io }));
vi.mock('../app/login/context', () => ({
	useAuth: () => ({ user: { id: 'u1', name: 'Ada', email: 'ada@example.test' }, isLoading: false }),
}));
vi.mock('../app/login/controller', () => ({ getToken: () => 'fake-token' }));

// Surfaces the live context value to the test, the same way LobbyPage reads
// it via useLobbySocket() - but here the test can inspect it directly.
function ContextProbe({ onValue }: { onValue: (_value: ReturnType<typeof useLobbySocket>) => void }) {
	onValue(useLobbySocket());
	return null;
}

describe('LobbySocketProvider game-started handling', () => {
	it('sets gameStarted when lobby:game-started is emitted', () => {
		let latest: ReturnType<typeof useLobbySocket> | undefined;
		render(
			<LobbySocketProvider>
				<ContextProbe onValue={(value) => { latest = value; }} />
			</LobbySocketProvider>,
		);

		act(() => {
			latest?.connect();
		});
		act(() => {
			// server.ts emits this event with no arguments - the listener must
			// not depend on a payload that was never sent (see server.ts).
			socketHarness.fireLatestGameStarted();
		});

		expect(latest?.gameStarted).toBe(true);
	});
});
