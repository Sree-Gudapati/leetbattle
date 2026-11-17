// Tests for the team chat panel on the match screen (US-3-T-1).
// Pseudocode these tests were written from: test/chat-test-pseudo.md
//
// Nothing here talks to a backend: the comments are mocked data handed to the
// chat provider, the signed-in player is a fake, and the one test that renders
// the whole match screen serves its problems from a stubbed fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeUser, jsonResponse, stubFetch, threeProblems } from './helpers';

// Monaco needs a real browser; swap it for a plain textarea.
vi.mock('@monaco-editor/react', () => ({
	default: ({ value, onChange }: { value: string; onChange: (_v: string) => void }) => (
		<textarea data-testid="monaco" value={value} onChange={(e) => onChange(e.target.value)} />
	),
}));

// The signed-in player is "Ada" (u1); comments they post carry that name.
vi.mock('../app/login/context', () => ({
	useAuth: () => ({ user: fakeUser, isLoading: false }),
}));
vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import EditorPage from '../app/editor/page';
import TeamChat from '../app/editor/components/team-chat';
import { ChatProvider } from '../app/editor/chat-context';
import type { ChatMessage } from '../app/editor/chat-context';

// Mocked team comments from two teammates.
const teamComments: ChatMessage[] = [
	{ id: 'm1', userId: 'u2', displayName: 'Grace', text: 'I will take question 2' },
	{ id: 'm2', userId: 'u3', displayName: 'Katherine', text: 'Try a hash map' },
];

// Renders only the chat panel, starting from the given mocked comments.
function renderChat(comments: ChatMessage[] = teamComments) {
	render(
		<ChatProvider initialMessages={comments}>
			<TeamChat />
		</ChatProvider>,
	);
}

// The box the player types a comment into.
function messageBox(): HTMLInputElement {
	return screen.getByRole('textbox', { name: 'Message your team' }) as HTMLInputElement;
}

// The button that posts the comment.
function sendButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
}

beforeEach(() => {
	vi.unstubAllGlobals();
});

afterEach(() => cleanup());

describe('team chat panel on the match screen', () => {
	it('US-3-T-1 shows a "Team chat" panel when the match screen loads', async () => {
		// The match screen loads its problems from CodeService; serve them from a fake.
		stubFetch(() => jsonResponse(threeProblems));
		render(<EditorPage />);

		// The panel is a labelled region of the match screen.
		expect(await screen.findByRole('region', { name: 'Team chat' })).toBeTruthy();
	});
});

describe('reading team comments', () => {
	it('US-3-T-1 shows the text of each team comment', () => {
		renderChat();

		// Both mocked comments are listed, one list item each.
		expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
			expect.stringContaining('I will take question 2'),
			expect.stringContaining('Try a hash map'),
		]);
	});

	it('US-3-T-1 shows the name of the player who posted each comment', () => {
		renderChat();

		// Each list item starts with its author's name.
		expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
			expect.stringContaining('Grace'),
			expect.stringContaining('Katherine'),
		]);
	});

	it('US-3-T-1 shows "No messages yet" when the team has no comments', () => {
		renderChat([]);

		// With nothing to read, the panel says so instead of showing an empty box.
		expect(screen.getByText('No messages yet')).toBeTruthy();
	});
});

describe('posting a team comment', () => {
	it('US-3-T-1 shows a comment after the player types it and clicks Send', async () => {
		const user = userEvent.setup();
		renderChat();

		await user.type(messageBox(), 'Question 1 is done');
		await user.click(sendButton());

		// The new comment joins the list of team comments.
		expect(screen.getByText('Question 1 is done')).toBeTruthy();
	});

	it('US-3-T-1 shows the signed-in player\'s name on a comment they post', async () => {
		const user = userEvent.setup();
		renderChat([]);

		await user.type(messageBox(), 'Question 1 is done');
		await user.click(sendButton());

		// The signed-in player is Ada, so the only comment is attributed to her.
		expect(screen.getByRole('listitem').textContent).toContain('Ada');
	});

	it('US-3-T-1 posts the comment when the player presses Enter', async () => {
		const user = userEvent.setup();
		renderChat();

		// "{Enter}" presses the Enter key after typing, without touching Send.
		await user.type(messageBox(), 'On it{Enter}');

		expect(screen.getByText('On it')).toBeTruthy();
	});

	it('US-3-T-1 empties the message box after posting', async () => {
		const user = userEvent.setup();
		renderChat();

		await user.type(messageBox(), 'Question 1 is done');
		await user.click(sendButton());

		// The box is ready for the next comment.
		expect(messageBox().value).toBe('');
	});

	it('US-3-T-1 trims the spaces around a posted comment', async () => {
		const user = userEvent.setup();
		renderChat([]);

		await user.type(messageBox(), '   Need help on 3   ');
		await user.click(sendButton());

		// The comment's own text has no leading or trailing spaces.
		expect(screen.getByTestId('chat-text').textContent).toBe('Need help on 3');
	});

	it('US-3-T-1 disables Send while the message box is empty', () => {
		renderChat();

		// Nothing typed yet, so there is nothing to post.
		expect(sendButton().disabled).toBe(true);
	});

	it('US-3-T-1 disables Send while the message box only has spaces', async () => {
		const user = userEvent.setup();
		renderChat();

		await user.type(messageBox(), '   ');

		// Spaces alone are not a comment.
		expect(sendButton().disabled).toBe(true);
	});
});
