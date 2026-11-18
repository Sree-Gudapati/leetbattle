// US-6-T-8 (all API and WebSocket responses are mocked; no real services are called)
// US-6-T-8 App should check for an active match on the lobby page without blocking it
//  - When a signed-in user opens the lobby page, the app should request GET /game/<userId> with the login token
//  - When no user is signed in, the app should not request GET /game/<userId>
//  - When the player comes back to the lobby from another page, the app should request GET /game/<userId> again
//  - While the check is still pending, the lobby page's content should already be rendered
//  - On a page other than the lobby, the app should not request GET /game/<userId>
// US-6-T-8 The lobby page should show Rejoin Match while the player has an active match
//  - When the check returns an active match, a "Rejoin Match" button should be shown on the lobby page
//  - After refreshing the lobby page (fresh render) with an active match, a "Rejoin Match" button should be shown
//  - When the check returns 404, no "Rejoin Match" button should be shown
//  - When the check fails with a network error, no "Rejoin Match" button should be shown
//  - After leaving the lobby for another page, no "Rejoin Match" button should be shown there
// US-6-T-8 Clicking Rejoin Match should return the player to their match
//  - Clicking "Rejoin Match" should navigate to the gameRoute from the check (/game/<gameId>)
//  - On the game page reached by rejoining, the socket should connect with the same gameId
//  - When the game socket sends the current game state, the game page should show that match's players
// US-6-T-8 App should explain when the match ended before the rejoin
//  - When the game socket rejects the connection with "not-in-game", "This match is no longer available." should be displayed
//  - After the "not-in-game" rejection, no "Rejoin Match" button should be shown
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fakeUser, jsonResponse, requestsOf, stubFetch } from './helpers';
import type { User } from '../app/login/controller';

// Everything the app talks to is faked: the router (so a test can change the
// route), the signed-in user, and socket.io-client (so the game page's
// socket never opens a real connection).
const mocks = vi.hoisted(() => ({
	pathname: '/lobby',
	push: vi.fn(),
	user: null as User | null,
	io: vi.fn(),
}));

vi.mock('next/navigation', () => ({
	usePathname: () => mocks.pathname,
	useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
	useParams: () => ({ gameId: 'game-1' }),
}));
vi.mock('../app/login/context', () => ({ useAuth: () => ({ user: mocks.user, isLoading: false }) }));
vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => mocks.io(...args) }));
// Monaco needs a real browser; the game page only mounts it while playing, but it is imported either way.
vi.mock('@monaco-editor/react', () => ({ default: () => null }));

import { RejoinProvider } from '../app/_shared/rejoin-context';
import GamePage from '../app/game/[gameId]/page';

// Matches the NEXT_PUBLIC_GAME_URL fallback in app/game/socket-context.tsx.
const GAME_URL = 'http://localhost:4004';
const CHECK_URL = `${GAME_URL}/game/${fakeUser.id}`;
const TOKEN = 'token-for-ada';

// What GET /game/:id answers for a player with an active match.
const ACTIVE_MATCH = { gameId: 'game-1', socketUrl: GAME_URL, gameRoute: '/game/game-1' };

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
		off: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn(),
		emit: vi.fn(),
	};
	const fire = (event: string, payload?: unknown) => act(() => {
		for (const handler of handlers.get(event) ?? []) handler(payload);
	});
	return { socket, fire };
}

// A match still waiting on a reconnecting player, as GameService sends it on `game:state`.
const waitingGame = {
	gameId: 'game-1',
	phase: 'waiting',
	startedAt: null,
	secondsRemaining: 20 * 60,
	banSecondsRemaining: 0,
	scores: { a: 0, b: 0 },
	problemPool: [],
	players: [
		{ userId: 'u1', displayName: 'Ada', team: 'a', connected: true, left: false },
		{ userId: 'u2', displayName: 'Grace', team: 'b', connected: false, left: false },
	],
	forfeitVotes: { a: 0, b: 0 },
};

// Answers the rejoin check with `answer`, standing in for GameService.
function stubCheck(answer: () => Response | Promise<Response>) {
	return stubFetch(() => answer());
}

// The app shell as the root layout builds it: the rejoin check around whatever
// page is open (by default the lobby, at the mocked pathname '/lobby').
function renderApp(page: ReactNode = <p>Lobby page</p>) {
	return render(<RejoinProvider>{page}</RejoinProvider>);
}

// Lets pending fetches and effects settle, for tests that check nothing happened.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

// Plays out a rejoin: the player sees Rejoin Match on the lobby page, clicks it,
// and the app moves to the game page. Resolves with the game page's fake socket.
async function rejoinIntoGame() {
	const fake = fakeSocket();
	mocks.io.mockReturnValue(fake.socket);
	stubCheck(() => jsonResponse(ACTIVE_MATCH));
	const app = renderApp();
	fireEvent.click(await screen.findByRole('button', { name: 'Rejoin Match' }));
	mocks.pathname = '/game/game-1';
	app.rerender(<RejoinProvider><GamePage /></RejoinProvider>);
	return { ...fake, app };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	mocks.pathname = '/lobby';
	mocks.user = fakeUser;
	localStorage.setItem('authToken', TOKEN);
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('US-6-T-8 checking for an active match', () => {
	it('US-6-T-8 requests GET /game/<userId> with the login token when the lobby page opens', async () => {
		const fetch = stubCheck(() => jsonResponse(ACTIVE_MATCH));
		renderApp();
		await waitFor(() => expect(requestsOf(fetch)[0]).toMatchObject({ url: CHECK_URL, headers: { Authorization: `Bearer ${TOKEN}` } }));
	});

	it('US-6-T-8 does not check when no user is signed in', async () => {
		mocks.user = null;
		const fetch = stubCheck(() => jsonResponse(ACTIVE_MATCH));
		renderApp();
		await settle();
		expect(fetch).not.toHaveBeenCalled();
	});

	// Lobby -> settings -> lobby: one check per lobby visit, none on the settings page.
	it('US-6-T-8 checks again when the player comes back to the lobby', async () => {
		const fetch = stubCheck(() => jsonResponse(ACTIVE_MATCH));
		const app = renderApp();
		await screen.findByRole('button', { name: 'Rejoin Match' });
		mocks.pathname = '/settings';
		app.rerender(<RejoinProvider><p>Settings page</p></RejoinProvider>);
		mocks.pathname = '/lobby';
		app.rerender(<RejoinProvider><p>Lobby page</p></RejoinProvider>);
		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
	});

	// The check never answers here, so the page only shows if it doesn't wait for it.
	it('US-6-T-8 renders the lobby page while the check is still pending', () => {
		stubCheck(() => new Promise<Response>(() => undefined));
		renderApp();
		expect(screen.getByText('Lobby page')).toBeTruthy();
	});

	it('US-6-T-8 does not check on a page other than the lobby', async () => {
		mocks.pathname = '/settings';
		const fetch = stubCheck(() => jsonResponse(ACTIVE_MATCH));
		renderApp(<p>Settings page</p>);
		await settle();
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('US-6-T-8 Rejoin Match on the lobby page', () => {
	it('US-6-T-8 shows Rejoin Match on the lobby page when the player has an active match', async () => {
		stubCheck(() => jsonResponse(ACTIVE_MATCH));
		renderApp();
		expect(await screen.findByRole('button', { name: 'Rejoin Match' })).toBeTruthy();
	});

	// A refresh throws the app away and renders it again from nothing.
	it('US-6-T-8 shows Rejoin Match again after refreshing the lobby page', async () => {
		stubCheck(() => jsonResponse(ACTIVE_MATCH));
		const first = renderApp();
		await screen.findByRole('button', { name: 'Rejoin Match' });
		first.unmount();
		renderApp();
		expect(await screen.findByRole('button', { name: 'Rejoin Match' })).toBeTruthy();
	});

	it('US-6-T-8 hides Rejoin Match when the player has no active match', async () => {
		stubCheck(() => jsonResponse({ error: 'no active game for that player' }, 404));
		renderApp();
		await settle();
		expect(screen.queryByRole('button', { name: 'Rejoin Match' })).toBeNull();
	});

	it('US-6-T-8 hides Rejoin Match when the check fails with a network error', async () => {
		stubCheck(() => Promise.reject(new TypeError('Failed to fetch')));
		renderApp();
		await settle();
		expect(screen.queryByRole('button', { name: 'Rejoin Match' })).toBeNull();
	});

	// The lobby found a match, so only the page change can explain the button being gone.
	it('US-6-T-8 does not show Rejoin Match on a page other than the lobby', async () => {
		stubCheck(() => jsonResponse(ACTIVE_MATCH));
		const app = renderApp();
		await screen.findByRole('button', { name: 'Rejoin Match' });
		mocks.pathname = '/settings';
		app.rerender(<RejoinProvider><p>Settings page</p></RejoinProvider>);
		expect(screen.queryByRole('button', { name: 'Rejoin Match' })).toBeNull();
	});
});

describe('US-6-T-8 rejoining the match', () => {
	it('US-6-T-8 navigates to the match\'s gameRoute when Rejoin Match is clicked', async () => {
		stubCheck(() => jsonResponse(ACTIVE_MATCH));
		renderApp();
		fireEvent.click(await screen.findByRole('button', { name: 'Rejoin Match' }));
		expect(mocks.push).toHaveBeenCalledWith('/game/game-1');
	});

	it('US-6-T-8 connects the game socket to the same match after rejoining', async () => {
		await rejoinIntoGame();
		await waitFor(() => expect(mocks.io.mock.calls[0]?.[1]).toMatchObject({ auth: { gameId: 'game-1' } }));
	});

	it('US-6-T-8 shows the match\'s players once the game state arrives after rejoining', async () => {
		const { fire } = await rejoinIntoGame();
		await fire('connect');
		await fire('game:state', waitingGame);
		expect(await screen.findByText('Grace')).toBeTruthy();
	});
});

describe('US-6-T-8 a match that ended before the rejoin', () => {
	it('US-6-T-8 explains that the match is no longer available', async () => {
		const { fire } = await rejoinIntoGame();
		await fire('connect_error', new Error('not-in-game'));
		expect((await screen.findByRole('alert')).textContent).toContain('This match is no longer available.');
	});

	// Rejoin Match is only on the lobby page, so the player goes back there to
	// look. The next check never answers, so only a cleared button (not a
	// fresh 404) can explain it being gone.
	it('US-6-T-8 clears Rejoin Match once the match is no longer available', async () => {
		const { fire, app } = await rejoinIntoGame();
		await fire('connect_error', new Error('not-in-game'));
		await screen.findByRole('alert');
		stubCheck(() => new Promise<Response>(() => undefined));
		mocks.pathname = '/lobby';
		app.rerender(<RejoinProvider><p>Lobby page</p></RejoinProvider>);
		await settle();
		expect(screen.queryByRole('button', { name: 'Rejoin Match' })).toBeNull();
	});
});
