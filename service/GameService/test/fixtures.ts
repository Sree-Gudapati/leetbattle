// Shared fixtures for the GameService tests. Every suite that creates a game
// needs the same two things: a six-player roster and a stand-in for
// CodeService's problem endpoint, so they live here rather than in each file.
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

export type TeamId = 'a' | 'b';

export interface ReadyPlayer {
	userId: string;
	displayName: string;
	team: TeamId;
}

// Six LobbyPlayer-shaped entries split 3/3 across teams 'a' and 'b', matching
// the payload LobbyService's `lobby:ready-for-match` event sends. Fresh
// random userIds each call, since GameService has no cross-service FK to
// AuthService's users table - any UUID is a valid player for this service.
export function sixReadyPlayers(): ReadyPlayer[] {
	return [0, 1, 2, 3, 4, 5].map((i) => ({
		userId: randomUUID(),
		displayName: `player-${i}`,
		team: i < 3 ? 'a' : 'b',
	}));
}

// Stands in for CodeService's GET /problem?difficulty=&quantity= endpoint.
// Returns plausible problem rows (task_id, question_id, difficulty) sized to
// whatever `quantity` the caller asked for, labelled with the requested
// difficulty, so createGame's two calls (6 easy + 3 medium) both resolve with
// usable rows. question_ids count up from 1 across calls, so they stay unique.
export function fakeCodeServiceFetch() {
	let nextQuestionId = 1;
	return vi.fn((url: string) => {
		const params = new URL(url).searchParams;
		const quantity = Number(params.get('quantity') ?? 0);
		const difficulty = params.get('difficulty');
		const problems = Array.from({ length: quantity }, (_, i) => ({
			task_id: `${url}-${i}`,
			question_id: nextQuestionId++,
			difficulty,
		}));
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(problems),
		} as Response);
	});
}
