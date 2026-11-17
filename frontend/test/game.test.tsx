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
// (The "Each problem in the match pool should be listed" and "Game page should
// show each problem's details" tests were removed by US-6-T-5: the game page no
// longer lists the match's questions.)
// Game page should show a win by solving every problem
//  - When the game was won by solving every problem, "by solving every problem" should be displayed
// Game page should show the ban screen during the ban phase
//  - While the game is banning, "Ban a question" should be displayed
//  - While the game is banning, the problem list for play should not be displayed
//  - While the game is banning, the Forfeit button should not be shown
//  - While the game is banning, the time left to ban should be displayed
//  - Once the game is playing, "Ban a question" should not be displayed
// Game page should run the ban screen from the game state
//  - Each problem in the match pool should be shown on the ban screen by its topics
//  - Clicking "Ban this question" should send that problem's questionId to the game
//  - A problem the game state shows banned by another player should display "Banned by <name>"
//  - With four players and one ban made, "1 of 4 bans made" should be displayed
//  - With four players, the ban screen should display four ban markers
//  (all socket traffic is mocked; no test touches GameService)
// US-6-T-5: The game page should not list the match's questions
//  - While the game is waiting for players, no question name should be displayed
//  - While the game is playing, the "Problems" list should not be displayed
// US-6-T-6: Once the bans are in, the game page should show the practice editor
//  - While the game is playing, the code editor should be displayed
//  - While the game is banning, the code editor should not be displayed
//  - While the game is waiting for players, the code editor should not be displayed
//  - The editor should have one question tab per problem left after the bans
//  - The editor should load each problem left in play from CodeService by its question_id
// Submitting in a match should go through the game
//  - Clicking "Submit" should submit the current question's id and code to the game
//  - The game's grading result should be shown in the results panel
//  - When the game refuses a submission with "cooldown", a readable message should be shown
// Running code in a match should work like practice
//  - Clicking "Run" should run the code against CodeService
// A player's code should only go to their own team
//  - Editing code should send it to the game (team-only relay), not to the lobby socket
// US-3-T-2: The match page should show team chat while the game is being played
//  - While playing, the match page should display a "Team chat" panel
//  (CodeService's fetch and Monaco are mocked; no test touches a backend service)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeUser, jsonResponse, makeProblem, requestsOf, stubFetch } from './helpers';

// Shared mocks. The game page never talks to GameService in these tests: the
// auth context and the game socket context are replaced with fakes.
const gameMocks = vi.hoisted(() => ({
	useGameSocket: vi.fn(),
	connect: vi.fn(),
	clearError: vi.fn(),
	forfeit: vi.fn(),
	ban: vi.fn(),
	submit: vi.fn(),
	shareCode: vi.fn(),
	// socket.io-client's io(): the editor must never open a lobby socket in a match.
	io: vi.fn(),
}));

// Monaco needs a real browser; swap it for a textarea with the same contract
// (controlled `value`, `onChange(value)`), as the practice editor tests do.
vi.mock('@monaco-editor/react', () => ({
	default: ({ value, onChange }: { value: string; onChange: (_v: string) => void }) => (
		<textarea data-testid="monaco" value={value} onChange={(e) => onChange(e.target.value)} />
	),
}));
vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => gameMocks.io(...args) }));

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
		ban: gameMocks.ban,
		submit: gameMocks.submit,
		shareCode: gameMocks.shareCode,
		...context,
	});
}

// The page once the socket is up and the server has sent the match.
function configureConnectedGame(overrides: Record<string, unknown> = {}) {
	configureGame({ socket: { connected: true, emit: vi.fn(), on: vi.fn(), off: vi.fn() }, connected: true, game: gameState(overrides) });
}

// Matches the NEXT_PUBLIC_CODE_URL fallback in app/editor/controller.tsx.
const CODE_URL = 'http://127.0.0.1:4001';

// Stands in for CodeService: GET /problem/:questionId serves a full problem
// for whichever question_id was asked for; POST /solution (Run) answers one
// passing case.
function stubCodeService() {
	return stubFetch((url, init) => {
		if (url === `${CODE_URL}/solution` && init?.method === 'POST') {
			return jsonResponse([{ verdict: 'Accepted', expected: '1', response: '1' }]);
		}
		return jsonResponse(makeProblem(Number(url.split('/').pop()), 'Easy'));
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
	// Every test gets a fake CodeService, so a playing game's editor never
	// reaches a real one.
	stubCodeService();
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

	it('US-6-T-2 says when the game was won by solving every problem', () => {
		configureEndedGame({ winner: 'a', reason: 'solved' });
		render(<GamePage />);

		expect(screen.getByText(/by solving every problem/)).toBeTruthy();
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

describe('game page without the question list', () => {
	it('US-6-T-5 shows no question name while waiting for players', () => {
		configureConnectedGame({ phase: 'waiting' });
		render(<GamePage />);

		// "Two Sum" is the first problem in the mocked pool; its name must not appear.
		expect(screen.queryByText(/Two Sum/)).toBeNull();
	});

	it('US-6-T-5 does not show the "Problems" list while playing', () => {
		configureConnectedGame();
		render(<GamePage />);

		expect(screen.queryByRole('list', { name: 'Problems' })).toBeNull();
	});
});

describe('game page during the ban phase', () => {
	// The nine-problem pool as GameService sends it while banning: each problem
	// carries its topics and who (if anyone) has banned it.
	const banPool = [
		{ taskId: 'two-sum', questionId: 1, difficulty: 'Easy', topics: ['Array', 'Hash Table'], bannedBy: null },
		{ taskId: 'valid-parentheses', questionId: 2, difficulty: 'Easy', topics: ['Stack'], bannedBy: null },
		{ taskId: 'climbing-stairs', questionId: 3, difficulty: 'Easy', topics: ['Dynamic Programming'], bannedBy: null },
		{ taskId: 'valid-palindrome', questionId: 4, difficulty: 'Easy', topics: ['String'], bannedBy: null },
		{ taskId: 'search-insert-position', questionId: 5, difficulty: 'Easy', topics: ['Binary Search'], bannedBy: null },
		{ taskId: 'assign-cookies', questionId: 6, difficulty: 'Easy', topics: ['Greedy'], bannedBy: null },
		{ taskId: 'number-of-islands', questionId: 7, difficulty: 'Medium', topics: ['Graph'], bannedBy: null },
		{ taskId: 'coin-change', questionId: 8, difficulty: 'Medium', topics: ['Dynamic Programming', 'Array'], bannedBy: null },
		{ taskId: 'course-schedule', questionId: 9, difficulty: 'Medium', topics: ['Topological Sort'], bannedBy: null },
	];

	// Grace (u2, Team 1) has banned the second problem.
	const poolWithGraceBan = banPool.map((entry) => (entry.questionId === 2
		? { ...entry, bannedBy: { userId: 'u2', displayName: 'Grace', team: 'a' } }
		: entry));

	// A 2v2: Ada and Grace on Team 1, Alan and Edsger on Team 2.
	const fourPlayers = roster.filter((entry) => ['u1', 'u2', 'u4', 'u5'].includes(entry.userId));

	// The page while the bans are going on, 25 seconds left to ban.
	function configureBanning(overrides: Record<string, unknown> = {}) {
		configureConnectedGame({ phase: 'banning', startedAt: null, banSecondsRemaining: 25, problemPool: banPool, ...overrides });
	}

	it('shows "Ban a question" while the game is banning', () => {
		configureBanning();
		render(<GamePage />);

		expect(screen.getByRole('heading', { name: 'Ban a question' })).toBeTruthy();
	});

	it('hides the problem list for play while the game is banning', () => {
		configureBanning();
		render(<GamePage />);

		// The "Problems" list is the in-match list; problems are only picked once play starts.
		expect(screen.queryByRole('list', { name: 'Problems' })).toBeNull();
	});

	it('hides the Forfeit button while the game is banning', () => {
		configureBanning();
		render(<GamePage />);

		expect(screen.queryByRole('button', { name: 'Forfeit' })).toBeNull();
	});

	it('shows the time left to ban while the game is banning', () => {
		configureBanning();
		render(<GamePage />);

		// 25 seconds left in the ban window, shown as minutes and seconds.
		expect(screen.getByText('0:25')).toBeTruthy();
	});

	it('does not show "Ban a question" once the game is playing', () => {
		configureConnectedGame();
		render(<GamePage />);

		expect(screen.queryByRole('heading', { name: 'Ban a question' })).toBeNull();
	});

	it('shows each problem in the pool by its topics on the ban screen', () => {
		configureBanning();
		render(<GamePage />);

		// Every topic of every problem, in pool order.
		expect(screen.getAllByTestId('topic').map((topic) => topic.textContent))
			.toEqual(banPool.flatMap((entry) => entry.topics));
	});

	it('sends the problem\'s questionId to the game when "Ban this question" is clicked', async () => {
		const user = userEvent.setup();
		configureBanning();
		render(<GamePage />);

		// The third problem, climbing-stairs, has questionId 3.
		await user.click(screen.getAllByRole('button', { name: /Ban this question/ })[2]);

		expect(gameMocks.ban).toHaveBeenCalledWith(3);
	});

	it('shows "Banned by <name>" on a problem another player banned', () => {
		configureBanning({ problemPool: poolWithGraceBan });
		render(<GamePage />);

		expect(screen.getByText(/Banned by/).textContent).toContain('Grace');
	});

	it('shows "1 of 4 bans made" with four players and one ban made', () => {
		configureBanning({ players: fourPlayers, problemPool: poolWithGraceBan });
		render(<GamePage />);

		expect(screen.getByText('1 of 4 bans made')).toBeTruthy();
	});

	it('shows four ban markers with four players', () => {
		configureBanning({ players: fourPlayers });
		const { container } = render(<GamePage />);

		// One marker per player, filled or not.
		expect(container.querySelectorAll('[data-seat]')).toHaveLength(4);
	});
});

describe('game page editor after the bans', () => {
	// makeProblem(1, ...) titles itself "1. Problem Number 1" once loaded.
	async function renderPlayingGame() {
		configureConnectedGame();
		render(<GamePage />);
		await screen.findByRole('heading', { name: /1\. Problem Number 1/ });
	}

	// The game's grading for an accepted solution (CodeService's POST /solution/:questionId shape).
	const accepted = { verdict: 'Accepted', passed: 3, total: 3, case: null, expected: null, response: null };

	it('US-6-T-6 shows the code editor while the game is playing', async () => {
		configureConnectedGame();
		render(<GamePage />);

		expect(await screen.findByTestId('monaco')).toBeTruthy();
	});

	it('US-6-T-6 does not show the code editor while the game is banning', () => {
		const banPool = problemPool.map((entry) => ({ ...entry, topics: ['Array'], bannedBy: null }));
		configureConnectedGame({ phase: 'banning', banSecondsRemaining: 25, problemPool: banPool });
		render(<GamePage />);

		expect(screen.queryByTestId('monaco')).toBeNull();
	});

	it('US-6-T-6 does not show the code editor while waiting for players', () => {
		configureConnectedGame({ phase: 'waiting' });
		render(<GamePage />);

		expect(screen.queryByTestId('monaco')).toBeNull();
	});

	it('US-6-T-6 gives the editor one question tab per problem left after the bans', async () => {
		await renderPlayingGame();

		// The mocked pool has three problems left, so the question tabs are 1, 2 and 3.
		expect(screen.getAllByRole('button', { name: /^\d+$/ }).map((tab) => tab.textContent)).toEqual(['1', '2', '3']);
	});

	it('US-6-T-6 loads each problem left in play from CodeService by its question_id', async () => {
		const fetchMock = stubCodeService();
		await renderPlayingGame();

		// The pool's question_ids are 1, 2 and 3.
		expect(requestsOf(fetchMock).map((request) => request.url))
			.toEqual([`${CODE_URL}/problem/1`, `${CODE_URL}/problem/2`, `${CODE_URL}/problem/3`]);
	});

	it('US-6-T-6 submits the current question\'s id and code to the game', async () => {
		gameMocks.submit.mockResolvedValue(accepted);
		await renderPlayingGame();

		fireEvent.change(screen.getByTestId('monaco'), { target: { value: 'print(1)' } });
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(gameMocks.submit).toHaveBeenCalledWith(1, 'print(1)');
	});

	it('US-6-T-6 shows the game\'s grading result in the results panel', async () => {
		gameMocks.submit.mockResolvedValue(accepted);
		await renderPlayingGame();

		await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(await screen.findByText('Passed: 3 / 3')).toBeTruthy();
	});

	it('US-6-T-6 shows a readable message when the game refuses a submission', async () => {
		// The game socket context turns the "cooldown" refusal into this message.
		gameMocks.submit.mockRejectedValue(new Error('Your team just submitted. Wait a few seconds before submitting again.'));
		await renderPlayingGame();

		await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

		expect(await screen.findByText('Your team just submitted. Wait a few seconds before submitting again.')).toBeTruthy();
	});

	it('US-6-T-6 runs the code against CodeService like practice', async () => {
		const fetchMock = stubCodeService();
		await renderPlayingGame();

		await userEvent.click(screen.getByRole('button', { name: 'Run' }));

		// Run goes straight to CodeService's POST /solution, as in practice.
		await waitFor(() => expect(requestsOf(fetchMock).some((request) => request.url === `${CODE_URL}/solution` && request.method === 'POST')).toBe(true));
	});

	it('US-6-T-6 sends edited code to the game for the player\'s team', async () => {
		await renderPlayingGame();

		fireEvent.change(screen.getByTestId('monaco'), { target: { value: 'print(1)' } });

		// Sent for question 1 with the edited code in its open tab (debounced, so wait for it).
		await waitFor(() => expect(gameMocks.shareCode).toHaveBeenCalledWith(1, expect.objectContaining({
			tabs: [expect.objectContaining({ code: 'print(1)' })],
		})));
	});

	it('US-6-T-6 never opens a lobby socket for the editor in a match', async () => {
		await renderPlayingGame();

		fireEvent.change(screen.getByTestId('monaco'), { target: { value: 'print(1)' } });
		await waitFor(() => expect(gameMocks.shareCode).toHaveBeenCalled());

		// Code only leaves through the game (team-only); the lobby socket would reach both teams.
		expect(gameMocks.io).not.toHaveBeenCalled();
	});
});

describe('game page team chat', () => {
	it('US-3-T-2 shows a "Team chat" panel while the game is playing', async () => {
		configureConnectedGame();
		render(<GamePage />);

		expect(await screen.findByRole('region', { name: 'Team chat' })).toBeTruthy();
	});
});
