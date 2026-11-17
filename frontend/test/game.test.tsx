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
// Game page should show the match waiting for its players
//  - While the game is waiting with 2 of 6 players connected, "Waiting for players (2/6)" should be displayed
// Players should be able to forfeit from the top bar
//  - During a match, a "Forfeit" button should appear in the top bar
//  - The Forfeit button should sit to the left of the account menu button
//  - While the game is waiting for players, the Forfeit button should not be shown
//  - Clicking Forfeit should open a confirmation dialog
//  - Clicking Cancel should close the dialog without forfeiting
//  - Confirming should send the forfeit to the game
//  - After confirming, the Forfeit button should be disabled
// Game page should show the result once the game ends
//  - When team b wins, "Team 2 wins" should be displayed
//  - When the game was won by forfeit, "by forfeit" should be displayed
//  - The result screen should have a "Back to lobby" link
//  - When the game ends in a draw, "Draw" should be displayed
//  - Once the game has ended, the Forfeit button should not be shown
// Game page should show each problem's details
//  - Each problem in the match pool should show its difficulty
//  - Before a problem is picked, no problem description should be shown
//  - Clicking a problem should load it from CodeService by its question_id
//  - Once loaded, the clicked problem's description should be displayed
//  - When the problem fails to load, an error should be displayed
//  (CodeService's fetch is mocked; no test calls a real service)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeUser, jsonResponse, makeProblem, stubFetch } from './helpers';

// Shared mocks. The game page never talks to GameService in these tests: the
// auth context and the game socket context are replaced with fakes.
const gameMocks = vi.hoisted(() => ({
	useGameSocket: vi.fn(),
	connect: vi.fn(),
	clearError: vi.fn(),
	forfeit: vi.fn(),
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

// The pool as GameService sends it on `game:state`: just enough to list each
// problem and to look it up in CodeService (by questionId) once it's clicked.
const problemPool = [
	{ taskId: 'two-sum', questionId: 1, difficulty: 'Easy' },
	{ taskId: 'valid-parentheses', questionId: 2, difficulty: 'Easy' },
	{ taskId: 'best-time-to-buy-and-sell-stock', questionId: 3, difficulty: 'Medium' },
];

// Matches the NEXT_PUBLIC_CODE_URL fallback in app/editor/controller.tsx.
const CODE_URL = 'http://127.0.0.1:4001';

// A freshly started match: full 20 minutes left, no score yet.
function gameState(overrides: Record<string, unknown> = {}) {
	return {
		gameId: 'game-1',
		phase: 'playing',
		startedAt: Date.now(),
		secondsRemaining: 20 * 60,
		scores: { a: 0, b: 0 },
		problemPool,
		players: roster,
		forfeitVotes: { a: 0, b: 0 },
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
		result: null,
		error: null,
		connect: gameMocks.connect,
		clearError: gameMocks.clearError,
		forfeit: gameMocks.forfeit,
		...context,
	});
}

// The page once the socket is up and the server has sent the match.
function configureConnectedGame(overrides: Record<string, unknown> = {}) {
	configureGame({ socket: { connected: true, emit: vi.fn() }, connected: true, game: gameState(overrides) });
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
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

describe('game page while waiting for players', () => {
	it('US-6-T-2 shows how many players have connected', () => {
		const twoConnected = roster.map((entry, i) => ({ ...entry, connected: i < 2 }));
		configureConnectedGame({ phase: 'waiting', players: twoConnected });
		render(<GamePage />);

		expect(screen.getByText('Waiting for players (2/6)')).toBeTruthy();
	});
});

describe('game page forfeit', () => {
	function forfeitButton() {
		return screen.getByRole('button', { name: 'Forfeit' });
	}

	it('US-6-T-2 shows a Forfeit button in the top bar during a match', () => {
		configureConnectedGame();
		render(<GamePage />);

		expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Forfeit' })).toBeTruthy();
	});

	it('US-6-T-2 puts the Forfeit button to the left of the account menu', () => {
		configureConnectedGame();
		render(<GamePage />);

		const menu = screen.getByRole('button', { name: 'Account menu' });
		// DOCUMENT_POSITION_FOLLOWING: the menu comes after the Forfeit button.
		expect(forfeitButton().compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('US-6-T-2 hides the Forfeit button while waiting for players', () => {
		configureConnectedGame({ phase: 'waiting' });
		render(<GamePage />);

		expect(screen.queryByRole('button', { name: 'Forfeit' })).toBeNull();
	});

	it('US-6-T-2 asks for confirmation when Forfeit is clicked', async () => {
		const user = userEvent.setup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(forfeitButton());

		expect(screen.getByRole('dialog', { name: 'Forfeit the match?' })).toBeTruthy();
	});

	it('US-6-T-2 closes the dialog without forfeiting when Cancel is clicked', async () => {
		const user = userEvent.setup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(forfeitButton());
		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect({ dialog: screen.queryByRole('dialog'), forfeits: gameMocks.forfeit.mock.calls.length }).toEqual({ dialog: null, forfeits: 0 });
	});

	it('US-6-T-2 sends the forfeit when confirmed', async () => {
		const user = userEvent.setup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(forfeitButton());
		await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Forfeit' }));

		expect(gameMocks.forfeit).toHaveBeenCalled();
	});

	it('US-6-T-2 disables the Forfeit button once the forfeit is sent', async () => {
		const user = userEvent.setup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(forfeitButton());
		await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Forfeit' }));

		expect((forfeitButton() as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('game page result', () => {
	function configureEndedGame(result: Record<string, unknown>) {
		configureGame({ connected: false, game: gameState(), result });
	}

	it('US-6-T-2 shows the winning team', () => {
		configureEndedGame({ winner: 'b', reason: 'forfeit' });
		render(<GamePage />);

		expect(screen.getByRole('heading', { name: 'Team 2 wins' })).toBeTruthy();
	});

	it('US-6-T-2 says when the game was won by forfeit', () => {
		configureEndedGame({ winner: 'b', reason: 'forfeit' });
		render(<GamePage />);

		expect(screen.getByText(/by forfeit/)).toBeTruthy();
	});

	it('US-6-T-2 links back to the lobby from the result', () => {
		configureEndedGame({ winner: 'a', reason: 'disconnect' });
		render(<GamePage />);

		expect(screen.getByRole('link', { name: 'Back to lobby' })).toBeTruthy();
	});

	it('US-6-T-2 shows a draw', () => {
		configureEndedGame({ winner: null, reason: 'time' });
		render(<GamePage />);

		expect(screen.getByRole('heading', { name: 'Draw' })).toBeTruthy();
	});

	it('US-6-T-2 hides the Forfeit button once the game has ended', () => {
		configureEndedGame({ winner: 'a', reason: 'time' });
		render(<GamePage />);

		expect(screen.queryByRole('button', { name: 'Forfeit' })).toBeNull();
	});
});

describe('game page problem details', () => {
	// Stands in for CodeService's GET /problem/:questionId: serves a full
	// problem row for whichever question_id was asked for.
	function stubProblemLookup() {
		return stubFetch((url) => {
			const questionId = Number(url.split('/').pop());
			return jsonResponse(makeProblem(questionId, 'Easy'));
		});
	}

	function problemButton(name: RegExp) {
		return within(screen.getByRole('list', { name: 'Problems' })).getByRole('button', { name });
	}

	it('US-6-T-2 shows each problem\'s difficulty', () => {
		configureConnectedGame();
		render(<GamePage />);

		// The pool is Easy, Easy, Medium.
		const problems = screen.getByRole('list', { name: 'Problems' });
		expect(within(problems).getAllByText('Easy')).toHaveLength(2);
	});

	it('US-6-T-2 shows no problem description before a problem is picked', () => {
		stubProblemLookup();
		configureConnectedGame();
		render(<GamePage />);

		expect(screen.queryByText(/Description for problem/)).toBeNull();
	});

	it('US-6-T-2 loads a clicked problem from CodeService by its question_id', async () => {
		const user = userEvent.setup();
		const fetchMock = stubProblemLookup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(problemButton(/Valid Parentheses/));

		// valid-parentheses has question_id 2 in the pool above.
		expect(fetchMock).toHaveBeenCalledWith(`${CODE_URL}/problem/2`, expect.anything());
	});

	it('US-6-T-2 shows the clicked problem\'s description once it loads', async () => {
		const user = userEvent.setup();
		stubProblemLookup();
		configureConnectedGame();
		render(<GamePage />);

		await user.click(problemButton(/Valid Parentheses/));

		// makeProblem(2, ...) describes itself as "Description for problem 2".
		expect(await screen.findByText('Description for problem 2')).toBeTruthy();
	});

	it('US-6-T-2 shows an error when the problem fails to load', async () => {
		const user = userEvent.setup();
		stubFetch(() => jsonResponse({ error: 'problem not found' }, 404));
		configureConnectedGame();
		render(<GamePage />);

		await user.click(problemButton(/Two Sum/));

		expect(await screen.findByText('Couldn\'t load this problem.')).toBeTruthy();
	});
});
