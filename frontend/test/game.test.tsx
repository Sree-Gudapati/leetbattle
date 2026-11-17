// US-6-T-2: Game page should connect to the game socket for the game in the URL
//  - On open, the page should connect using the gameId from the URL
//  - While the socket is not connected, "Joining match…" should be displayed
// Game page should show connection problems
//  - When the socket context has an error, its message should appear in an alert
//  - When the connection fails, a link back to the lobby should be shown
// Game page should show the match once connected
//  - Each player's display name should be rendered
//  - Team 1 should list its three players
//  - A player who is not connected should display "Reconnecting…"
//  - Each problem in the match pool should be listed
//  - The time remaining should be displayed as minutes and seconds
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { fakeUser } from './helpers';

// Shared mocks. The game page never talks to GameService in these tests: the
// auth context and the game socket context are replaced with fakes.
const gameMocks = vi.hoisted(() => ({
	useGameSocket: vi.fn(),
	connect: vi.fn(),
	clearError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
	// The page under test is always /game/game-1.
	useParams: () => ({ gameId: 'game-1' }),
}));
vi.mock('../app/login/context', () => ({ useAuth: () => ({ user: fakeUser, isLoading: false }) }));
vi.mock('../app/game/socket-context', () => ({
	GameSocketProvider: ({ children }: { children: React.ReactNode }) => children,
	useGameSocket: () => gameMocks.useGameSocket(),
}));

import GamePage from '../app/game/[gameId]/page';

type TeamId = 'a' | 'b';

interface TestPlayer {
	userId: string;
	displayName: string;
	team: TeamId;
	connected: boolean;
}

function player(userId: string, displayName: string, team: TeamId, connected = true): TestPlayer {
	return { userId, displayName, team, connected };
}

// Default roster: two full teams of three, with the signed-in user (u1, "Ada") on Team 1.
const roster: TestPlayer[] = [
	player('u1', 'Ada', 'a'),
	player('u2', 'Grace', 'a'),
	player('u3', 'Katherine', 'a'),
	player('u4', 'Alan', 'b'),
	player('u5', 'Edsger', 'b'),
	player('u6', 'Margaret', 'b'),
];

const problemPool = ['two-sum', 'valid-parentheses', 'best-time-to-buy-and-sell-stock'];

// A freshly started match: full 20 minutes left, no score yet.
function gameState(overrides: Record<string, unknown> = {}) {
	return {
		gameId: 'game-1',
		startedAt: Date.now(),
		secondsRemaining: 20 * 60,
		scores: { a: 0, b: 0 },
		problemPool,
		players: roster,
		...overrides,
	};
}

// Sets what useGameSocket returns for the next render. With no overrides the
// page is still waiting for the socket to connect.
function configureGame(context: Record<string, unknown> = {}) {
	gameMocks.useGameSocket.mockReturnValue({
		socket: null,
		connected: false,
		game: null,
		error: null,
		connect: gameMocks.connect,
		clearError: gameMocks.clearError,
		...context,
	});
}

// The page once the socket is up and the server has sent the match.
function configureConnectedGame(overrides: Record<string, unknown> = {}) {
	configureGame({ socket: { connected: true, emit: vi.fn() }, connected: true, game: gameState(overrides) });
}

beforeEach(() => {
	vi.clearAllMocks();
	configureGame();
});

afterEach(() => cleanup());

describe('game page connection', () => {
	it('US-6-T-2 connects to the game named in the URL on open', () => {
		render(<GamePage />);

		// The page asks the socket context to join /game/game-1's match.
		expect(gameMocks.connect).toHaveBeenCalledWith('game-1');
	});

	it('US-6-T-2 shows "Joining match…" while the socket is not connected', () => {
		render(<GamePage />);

		expect(screen.getByText('Joining match…')).toBeTruthy();
	});
});

describe('game page connection problems', () => {
	it('US-6-T-2 shows the socket error message in an alert', () => {
		configureGame({ error: { code: 'not-in-game', message: 'You are not a player in this match.' } });
		render(<GamePage />);

		expect(screen.getByRole('alert').textContent).toContain('You are not a player in this match.');
	});

	it('US-6-T-2 shows a link back to the lobby when the connection fails', () => {
		configureGame({ error: { code: 'connection-error', message: 'Could not connect to the game service.' } });
		render(<GamePage />);

		expect(screen.getByRole('link', { name: 'Back to lobby' })).toBeTruthy();
	});
});

describe('game page match view', () => {
	it('US-6-T-2 renders each player\'s display name', () => {
		configureConnectedGame();
		render(<GamePage />);

		const shown = roster.filter((entry) => screen.queryByText(entry.displayName) !== null);
		expect(shown).toHaveLength(6);
	});

	it('US-6-T-2 lists Team 1\'s three players', () => {
		configureConnectedGame();
		render(<GamePage />);

		const teamOne = screen.getByRole('list', { name: 'Team 1 players' });
		expect(within(teamOne).getAllByRole('listitem')).toHaveLength(3);
	});

	it('US-6-T-2 shows "Reconnecting…" for a player who is not connected', () => {
		configureConnectedGame({ players: roster.map((entry) => (entry.userId === 'u4' ? { ...entry, connected: false } : entry)) });
		render(<GamePage />);

		// Only Alan dropped, so exactly one row shows the reconnecting label.
		expect(screen.getAllByText('Reconnecting…')).toHaveLength(1);
	});

	it('US-6-T-2 lists each problem in the match pool', () => {
		configureConnectedGame();
		render(<GamePage />);

		const problems = screen.getByRole('list', { name: 'Problems' });
		expect(within(problems).getAllByRole('listitem')).toHaveLength(3);
	});

	it('US-6-T-2 shows the time remaining as minutes and seconds', () => {
		configureConnectedGame({ secondsRemaining: 20 * 60 });
		render(<GamePage />);

		expect(screen.getByText('20:00')).toBeTruthy();
	});
});
