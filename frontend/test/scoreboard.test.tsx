// Tests for the scoreboard on the match screen (issue #58, US-4-T-4).
// Pseudocode these tests were written from: test/scoreboard-test-pseudo.md
//
// No backend is touched: `useMatch` is replaced with a fake that serves mocked
// scores, timer and submissions; the timer test runs the real provider under
// fake timers; the match screen test stubs fetch and the auth context.
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeUser, jsonResponse, stubFetch, threeProblems } from './helpers';

const matchMocks = vi.hoisted(() => ({ useMatch: vi.fn() }));

vi.mock('@monaco-editor/react', () => ({
	default: () => <textarea data-testid="monaco" />,
}));
vi.mock('../app/login/context', () => ({
	useAuth: () => ({ user: fakeUser, isLoading: false }),
}));
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
// Keep the real provider (the editor page and the timer test need it) but let
// most tests choose what `useMatch` returns.
vi.mock('../app/editor/match-context', async (importOriginal) => ({
	...(await importOriginal<typeof import('../app/editor/match-context')>()),
	useMatch: () => matchMocks.useMatch(),
}));

import Scoreboard from '../app/editor/components/scoreboard';
import EditorPage from '../app/editor/page';

interface TestSubmission {
	id: string;
	displayName: string;
	team: 'a' | 'b';
	question: number;
	accepted: boolean;
	points: number;
}

const ADA_ACCEPTED: TestSubmission = { id: 's1', displayName: 'Ada', team: 'a', question: 3, accepted: true, points: 50 };
const ALAN_FAILED: TestSubmission = { id: 's2', displayName: 'Alan', team: 'b', question: 5, accepted: false, points: 0 };

// Renders the scoreboard with the given match data; unspecified parts get
// neutral defaults.
function renderScoreboard(match: {
	scores?: { a: number; b: number };
	secondsLeft?: number;
	submissions?: TestSubmission[];
} = {}) {
	matchMocks.useMatch.mockReturnValue({
		scores: { a: 0, b: 0 },
		secondsLeft: 600,
		submissions: [],
		...match,
	});
	return render(<Scoreboard />);
}

// Builds n submissions, newest first: the first one is "Player 1".
function manySubmissions(n: number): TestSubmission[] {
	return Array.from({ length: n }, (_, i) => ({
		id: `m${i + 1}`,
		displayName: `Player ${i + 1}`,
		team: 'a' as const,
		question: 1,
		accepted: false,
		points: 0,
	}));
}

beforeEach(() => {
	vi.unstubAllGlobals();
	matchMocks.useMatch.mockReset();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('scoreboard team scores', () => {
	it('US4-Task4 shows "Team 1"', () => {
		renderScoreboard();
		expect(screen.getByText('Team 1')).toBeTruthy();
	});

	it('US4-Task4 shows "Team 2"', () => {
		renderScoreboard();
		expect(screen.getByText('Team 2')).toBeTruthy();
	});

	it('US4-Task4 shows 120 as the Team 1 score when Team 1 has 120 points', () => {
		renderScoreboard({ scores: { a: 120, b: 0 } });
		expect(screen.getByTestId('score-a').textContent).toBe('120');
	});

	it('US4-Task4 shows 80 as the Team 2 score when Team 2 has 80 points', () => {
		renderScoreboard({ scores: { a: 0, b: 80 } });
		expect(screen.getByTestId('score-b').textContent).toBe('80');
	});

	it('US4-Task4 colours the Team 1 score with the primary colour', () => {
		renderScoreboard();
		expect(screen.getByTestId('score-a').className).toContain('text-primary');
	});

	it('US4-Task4 colours the Team 2 score with the secondary colour', () => {
		renderScoreboard();
		expect(screen.getByTestId('score-b').className).toContain('text-secondary');
	});
});

describe('scoreboard match timer', () => {
	it('US4-Task4 labels the timer "Time left"', () => {
		renderScoreboard();
		expect(screen.getByText('Time left')).toBeTruthy();
	});

	it('US4-Task4 shows 12:34 when 754 seconds are left', () => {
		renderScoreboard({ secondsLeft: 754 });
		expect(screen.getByText('12:34')).toBeTruthy();
	});

	it('US4-Task4 shows 01:05 when 65 seconds are left', () => {
		renderScoreboard({ secondsLeft: 65 });
		expect(screen.getByText('01:05')).toBeTruthy();
	});

	it('US4-Task4 shows 00:00 when no time is left', () => {
		renderScoreboard({ secondsLeft: 0 });
		expect(screen.getByText('00:00')).toBeTruthy();
	});

	it('US4-Task4 has one second less left after one second passes', async () => {
		// Use the real provider and hook, not the fake.
		const actual = await vi.importActual<typeof import('../app/editor/match-context')>(
			'../app/editor/match-context',
		);
		function Probe() {
			return <span data-testid="left">{actual.useMatch().secondsLeft}</span>;
		}
		vi.useFakeTimers();
		render(
			<actual.MatchProvider>
				<Probe />
			</actual.MatchProvider>,
		);
		const before = Number(screen.getByTestId('left').textContent);
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(Number(screen.getByTestId('left').textContent)).toBe(before - 1);
	});
});

describe('scoreboard recent submissions', () => {
	it('US4-Task4 shows the name of each player who submitted when there are two submissions', () => {
		renderScoreboard({ submissions: [ADA_ACCEPTED, ALAN_FAILED] });
		const list = screen.getByRole('list');
		expect(within(list).getAllByText(/^(Ada|Alan)$/).map((el) => el.textContent)).toEqual(['Ada', 'Alan']);
	});

	it('US4-Task4 shows a submission\'s question as "Question 3"', () => {
		renderScoreboard({ submissions: [ADA_ACCEPTED] });
		expect(screen.getByText('Question 3')).toBeTruthy();
	});

	it('US4-Task4 shows "Accepted" for an accepted submission', () => {
		renderScoreboard({ submissions: [ADA_ACCEPTED] });
		expect(screen.getByText('Accepted')).toBeTruthy();
	});

	it('US4-Task4 shows "+50" for an accepted submission worth 50 points', () => {
		renderScoreboard({ submissions: [ADA_ACCEPTED] });
		expect(screen.getByText('+50')).toBeTruthy();
	});

	it('US4-Task4 shows "Wrong answer" for a failed submission', () => {
		renderScoreboard({ submissions: [ALAN_FAILED] });
		expect(screen.getByText('Wrong answer')).toBeTruthy();
	});

	it('US4-Task4 shows "No submissions yet" when there are no submissions', () => {
		renderScoreboard({ submissions: [] });
		expect(screen.getByText('No submissions yet')).toBeTruthy();
	});

	it('US4-Task4 shows only the five most recent submissions when there are seven', () => {
		renderScoreboard({ submissions: manySubmissions(7) });
		expect(within(screen.getByRole('list')).getAllByRole('listitem').length).toBe(5);
	});
});

describe('match screen', () => {
	it('US4-Task4 shows the scoreboard when the match screen loads', async () => {
		stubFetch(() => jsonResponse(threeProblems));
		matchMocks.useMatch.mockReturnValue({ scores: { a: 0, b: 0 }, secondsLeft: 600, submissions: [] });
		render(<EditorPage />);
		expect(await screen.findByRole('region', { name: 'Scoreboard' })).toBeTruthy();
	});
});
