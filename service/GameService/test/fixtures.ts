// Shared fixtures for the GameService tests. Every suite that creates a game
// needs the same two things: a six-player roster and a stand-in for
// CodeService's problem endpoint, so they live here rather than in each file.
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { EncryptJWT } from 'jose';

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

// How long the fake CodeService takes to grade a submission, so a test can
// send a second submission while the first is still being graded.
export const FAKE_GRADING_MS = 50;

// Stands in for CodeService's POST /solution/:questionId endpoint. The code
// itself decides the outcome: "correct" is Accepted, "crash" makes CodeService
// fail with a 500, and anything else is a Wrong Answer.
function fakeGrading(init?: RequestInit): Promise<Response> {
	const { code } = JSON.parse(String(init?.body ?? '{}')) as { code?: string };
	if (code === 'crash') {
		return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'boom' }) } as Response);
	}
	const verdict = code === 'correct' ? 'Accepted' : 'Wrong Answer';
	return new Promise((resolve) => setTimeout(() => resolve({
		ok: true,
		json: () => Promise.resolve({ verdict, passed: verdict === 'Accepted' ? 3 : 1, total: 3 }),
	} as Response), FAKE_GRADING_MS));
}

// The tags the fake CodeService gives a problem: one shared topic plus one
// unique to the question, so a test can tell problems' topics apart.
export function fakeTags(questionId: number): string[] {
	return ['Array', `Topic ${questionId}`];
}

// Stands in for CodeService: grading (see fakeGrading above) and the
// GET /problem?difficulty=&quantity= endpoint.
// Returns plausible problem rows (task_id, question_id, difficulty) sized to
// whatever `quantity` the caller asked for, labelled with the requested
// difficulty, so createGame's two calls (6 easy + 3 medium) both resolve with
// usable rows. question_ids count up from 1 across calls, so they stay unique.
// Each row also carries CodeService's `tags` column (see fakeTags), which the
// ban screen shows as the problem's topics.
export function fakeCodeServiceFetch() {
	let nextQuestionId = 1;
	return vi.fn((url: string, init?: RequestInit) => {
		if (url.includes('/solution/')) return fakeGrading(init);
		const params = new URL(url).searchParams;
		const quantity = Number(params.get('quantity') ?? 0);
		const difficulty = params.get('difficulty');
		const problems = Array.from({ length: quantity }, (_, i) => {
			const questionId = nextQuestionId++;
			return {
				task_id: `${url}-${i}`,
				question_id: questionId,
				difficulty,
				tags: fakeTags(questionId),
			};
		});
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(problems),
		} as Response);
	});
}

// The SECRET the tests give GameService (process.env.SECRET), and a login
// token for `userId` the way AuthService issues one: encrypted with that
// SECRET and carrying the account's id/email.
export const TEST_SECRET = 'local-test-secret-'.padEnd(64, 'x');

export async function loginTokenFor(userId: string): Promise<string> {
	return new EncryptJWT({ id: userId, email: `${userId}@example.test` })
		.setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
		.setIssuedAt()
		.setExpirationTime('5m')
		.encrypt(new TextEncoder().encode(TEST_SECRET));
}
