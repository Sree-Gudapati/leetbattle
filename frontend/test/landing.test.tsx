// User clicks skip -> intro disappears immediately (without waiting for the
// 3300ms auto-dismiss timer to fire)
//
// (The live demo tests went with the old demo in US5-Task14; see landing-hero.test.tsx.)
//
// Clicking Log out in HomeNav calls logout()
// HomeNav renders nothing while the auth state is still loading

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeUser } from './helpers';
import Intro from '../app/_landing/intro';

const logout = vi.fn();
// A mock we can redirect per-test (e.g. to simulate isLoading) instead of the
// fixed fakeUser/not-loading state every test used to get.
const useAuthMock = vi.fn();
vi.mock('../app/login/context', () => ({
	useAuth: () => useAuthMock(),
}));

import HomeNav from '../app/_shared/home-nav';

beforeEach(() => {
	vi.clearAllMocks();
	useAuthMock.mockReturnValue({ user: fakeUser, logout, isLoading: false });
});
afterEach(() => {
	cleanup();
	document.documentElement.classList.remove('lb-intro-seen');
	vi.useRealTimers();
});

describe('intro', () => {
	it('shows the Skip button initially', () => {
		vi.useFakeTimers();
		render(<Intro />);
		expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
	});

	it('unmounts immediately when Skip is clicked, without waiting for the auto-dismiss timer', () => {
		// Fake timers mean the only way the overlay can disappear during this
		// test is the Skip click itself, not the 3300ms timeout.
		vi.useFakeTimers();
		render(<Intro />);

		fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

		expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
	});
});

describe('home nav', () => {
	it('logs out when the Log out button is clicked', async () => {
		render(<HomeNav />);
		await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
		expect(logout).toHaveBeenCalledTimes(1);
	});

	it('renders nothing while the auth state is still loading', () => {
		useAuthMock.mockReturnValue({ user: null, logout, isLoading: true });
		const { container } = render(<HomeNav />);
		expect(container.firstChild).toBeNull();
	});
});
