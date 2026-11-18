// Dev-only helper: starts a real match through GameService's own API (so it
// gets a real in-memory GameState, not just DB rows), so the practice
// editor's teammate workspace tabs (US-6-T-7) can be tested without going
// through the lobby's real matchmaking flow.
//
// Run from service/GameService (needs GameService + the dev Postgres up):
//   npx ts-node scripts/dev-match.ts --email you@example.com
//
// Every teammate slot not given a --teammate-email is filled by a bot that
// bans automatically and, once playing, pushes changing code every few
// seconds, so there's something live to look at read only with no one else
// around. To test real code sharing between two people instead, give a
// second real account's email:
//   npx ts-node scripts/dev-match.ts --email you@example.com --teammate-email teammate@example.com
//
// Log into the frontend as each printed real email (a second browser, or a
// different one in private mode, for a teammate) and open the printed
// /game/<id> URL. Named teammates are only added to the match's roster here —
// they type their own code themselves, nothing is pushed on their behalf.
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { EncryptJWT } from 'jose';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const GAME_URL = process.env.GAME_SERVICE_URL ?? 'http://localhost:4004';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

interface Args {
	email: string;
	teammates: number; // total teammate slots besides the real account; a bot fills any not named below
	teammateEmails: string[]; // real accounts to put in the first teammate slots instead of bots
}

const USAGE = 'Usage: ts-node scripts/dev-match.ts --email you@example.com [--teammates 0|1|2] [--teammate-email teammate@example.com ...]';

function parseArgs(): Args {
	const args = process.argv.slice(2);
	const get = (flag: string) => {
		const i = args.indexOf(flag);
		return i === -1 ? undefined : args[i + 1];
	};
	const getAll = (flag: string) => args.flatMap((arg, i) => (arg === flag ? [args[i + 1]] : []));

	const email = get('--email');
	if (!email) {
		console.error(USAGE);
		process.exit(1);
	}
	const teammateEmails = getAll('--teammate-email');
	if (teammateEmails.length > 2) {
		console.error('At most two teammates are possible (three players per team).');
		process.exit(1);
	}
	if (teammateEmails.includes(email)) {
		console.error('--teammate-email can\'t be the same account as --email.');
		process.exit(1);
	}
	const requestedTeammates = get('--teammates');
	const teammates = Math.min(2, Math.max(teammateEmails.length, requestedTeammates === undefined ? 2 : Number(requestedTeammates)));
	return { email, teammates, teammateEmails };
}

// Mints a session token the same way AuthService does, so GameService (which
// only checks the shared SECRET, not the AuthService database) accepts it.
async function tokenFor(id: string, email: string): Promise<string> {
	const secret = process.env.SECRET;
	if (!secret) throw new Error('SECRET is not set in the root .env');
	return new EncryptJWT({ id, email })
		.setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
		.setIssuedAt()
		.setExpirationTime('2h')
		.encrypt(new TextEncoder().encode(secret));
}

async function findRealUser(pool: Pool, email: string): Promise<{ id: string; name: string | null }> {
	const result = await pool.query<{ id: string; name: string | null }>('SELECT id, name FROM users WHERE email = $1', [email]);
	if (result.rows.length === 0) throw new Error(`No AuthService account for ${email}. Sign up with that email on the frontend first.`);
	return result.rows[0];
}

interface RosterEntry {
	userId: string;
	displayName: string;
	team: 'a' | 'b';
	bot: boolean;
	email?: string; // real players only; used to print who should log in where
}

// One problem in the pool, as GameService sends it on `game:state`.
interface PoolProblem {
	questionId: number;
	bannedBy: { userId: string } | null;
}
interface GameStatePayload {
	phase: 'waiting' | 'banning' | 'playing';
	problemPool: PoolProblem[];
}

// Connects one bot and makes it play along: bans as soon as the ban phase
// starts, then (teammates only) pushes changing code every few seconds once
// play starts, so the real account has something live to look at read only.
function runBot(entry: RosterEntry, gameId: string, token: string, shareCode: boolean): Socket {
	const socket = io(GAME_URL, { autoConnect: false, auth: { token, gameId } });
	let banned = false;
	let sharing: ReturnType<typeof setInterval> | undefined;

	socket.on('game:state', (state: GameStatePayload) => {
		if (state.phase === 'banning' && !banned) {
			const target = state.problemPool.find((problem) => !problem.bannedBy);
			if (target) {
				banned = true;
				socket.emit('game:ban', { questionId: target.questionId });
			}
		}
		if (state.phase === 'playing' && shareCode && !sharing) {
			const questionId = state.problemPool[0]?.questionId;
			if (questionId === undefined) return;
			let tick = 0;
			sharing = setInterval(() => {
				tick += 1;
				socket.emit('game:code', {
					questionId,
					workspace: {
						tabs: [{ id: 'tab-1', name: 'Tab 1', code: `# ${entry.displayName} is thinking... (${tick})\ndef solve():\n    return ${tick}` }],
						activeTabId: 'tab-1',
					},
				});
			}, 3_000);
		}
	});
	socket.on('connect_error', (err: Error) => console.error(`[${entry.displayName}] connect_error:`, err.message));
	socket.connect();
	return socket;
}

async function main() {
	const { email, teammates, teammateEmails } = parseArgs();
	const authPool = new Pool({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		database: process.env.AUTH_POSTGRES_DB ?? 'auth_service',
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
	});

	let roster: RosterEntry[];
	try {
		const real = await findRealUser(authPool, email);
		const teammateEntries: RosterEntry[] = await Promise.all(
			Array.from({ length: teammates }, async (_, i) => {
				const teammateEmail = teammateEmails[i];
				if (teammateEmail === undefined) {
					return { userId: randomUUID(), displayName: `Bot Teammate ${i + 1}`, team: 'a' as const, bot: true };
				}
				const teammate = await findRealUser(authPool, teammateEmail);
				return {
					userId: teammate.id,
					displayName: teammate.name?.trim() || teammateEmail.split('@')[0],
					team: 'a' as const,
					bot: false,
					email: teammateEmail,
				};
			}),
		);
		const teamSize = 1 + teammates;
		roster = [
			{ userId: real.id, displayName: real.name?.trim() || email.split('@')[0], team: 'a', bot: false, email },
			...teammateEntries,
			...Array.from({ length: teamSize }, (_, i) => ({ userId: randomUUID(), displayName: `Bot Opponent ${i + 1}`, team: 'b' as const, bot: true })),
		];
	} finally {
		await authPool.end();
	}

	const response = await fetch(`${GAME_URL}/game`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ players: roster.map(({ userId, displayName, team }) => ({ userId, displayName, team })) }),
	});
	if (!response.ok) {
		throw new Error(`GameService refused to create the match: ${response.status} ${await response.text()}`);
	}
	const { gameId } = await response.json() as { gameId: string };

	console.log(`Match created: ${gameId}`);
	console.log('Log in as each real player below, then open their /game/<id> URL:');
	for (const entry of roster.filter((player): player is RosterEntry & { email: string } => !player.bot)) {
		console.log(`  ${entry.email} -> ${FRONTEND_URL}/game/${gameId}`);
	}
	console.log('Bots fill the rest of the roster: they ban automatically, and bot teammates push changing code once play starts.');
	console.log('Press Ctrl+C to stop the bots.');

	const bots = await Promise.all(
		roster.filter((entry) => entry.bot).map(async (entry) => {
			const token = await tokenFor(entry.userId, `${entry.userId}@example.test`);
			return runBot(entry, gameId, token, entry.team === 'a');
		}),
	);

	process.on('SIGINT', () => {
		for (const socket of bots) socket.disconnect();
		process.exit(0);
	});
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
