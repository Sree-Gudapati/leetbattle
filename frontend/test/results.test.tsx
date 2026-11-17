// Tests for the end-of-match screen (US-4-T-5, issue #59).
// Pseudocode these tests were written from: test/results-test-pseudo.md
//
// The results screen never talks to a backend in these tests: the auth context
// and the results context are replaced with fakes, and the final scores and the
// signed-in player's team are mocked data.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const resultsMocks = vi.hoisted(() => ({
	useResults: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
// The signed-in player is u1, "Ada".
vi.mock('../app/login/context', () => ({
	useAuth: () => ({ user: { id: 'u1', name: 'Ada', email: 'ada@example.test' }, isLoading: false }),
}));
vi.mock('../app/results/context', () => ({ useResults: () => resultsMocks.useResults() }));

import ResultsPage from '../app/results/page';

// Sets the final scores and the signed-in player's team for the next render.
function configureResults(a: number, b: number, yourTeam: 'a' | 'b' = 'a') {
	resultsMocks.useResults.mockReturnValue({ scores: { a, b }, yourTeam });
}

beforeEach(() => {
	vi.clearAllMocks();
	configureResults(150, 90);
});

afterEach(() => cleanup());

describe('results screen winner', () => {
	it('US4-Task5 shows "Team 1 wins" when Team 1 has the higher score', () => {
		configureResults(150, 90);
		render(<ResultsPage />);

		expect(screen.getByText('Team 1 wins')).toBeTruthy();
	});

	it('US4-Task5 shows "Team 2 wins" when Team 2 has the higher score', () => {
		configureResults(90, 150);
		render(<ResultsPage />);

		expect(screen.getByText('Team 2 wins')).toBeTruthy();
	});

	it('US4-Task5 shows "Draw" when both teams have the same score', () => {
		configureResults(100, 100);
		render(<ResultsPage />);

		expect(screen.getByText('Draw')).toBeTruthy();
	});

	it('US4-Task5 shows "Victory" when the signed-in player\'s team won', () => {
		// The player is on Team 2, and Team 2 has the higher score.
		configureResults(90, 150, 'b');
		render(<ResultsPage />);

		expect(screen.getByText('Victory')).toBeTruthy();
	});

	it('US4-Task5 shows "Defeat" when the signed-in player\'s team lost', () => {
		// The player is on Team 1, and Team 2 has the higher score.
		configureResults(90, 150, 'a');
		render(<ResultsPage />);

		expect(screen.getByText('Defeat')).toBeTruthy();
	});
});

describe('results screen final scores', () => {
	it('US4-Task5 shows "150" as the Team 1 score when Team 1 finished with 150 points', () => {
		render(<ResultsPage />);

		expect(screen.getByTestId('score-a').textContent).toBe('150');
	});

	it('US4-Task5 shows "90" as the Team 2 score when Team 2 finished with 90 points', () => {
		render(<ResultsPage />);

		expect(screen.getByTestId('score-b').textContent).toBe('90');
	});

	it('US4-Task5 colours the Team 1 score with the primary colour', () => {
		render(<ResultsPage />);

		expect(screen.getByTestId('score-a').className).toContain('text-primary');
	});

	it('US4-Task5 colours the Team 2 score with the secondary colour', () => {
		render(<ResultsPage />);

		expect(screen.getByTestId('score-b').className).toContain('text-secondary');
	});
});

describe('results screen navigation', () => {
	it('US4-Task5 links "Play again" to the lobby', () => {
		render(<ResultsPage />);

		expect(screen.getByRole('link', { name: 'Play again' }).getAttribute('href')).toBe('/lobby');
	});

	it('US4-Task5 links "Back to home" to the home page', () => {
		render(<ResultsPage />);

		expect(screen.getByRole('link', { name: 'Back to home' }).getAttribute('href')).toBe('/');
	});
});
