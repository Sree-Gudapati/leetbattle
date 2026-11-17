// Runs once, before any test file starts (vitest.config.mts globalSetup).
//
// The schema used to be reset from each file's beforeAll in test/setup.ts, but
// vitest runs test files in parallel, so on an empty database (CI) two files
// raced each other's CREATE TABLE IF NOT EXISTS, which isn't safe across
// concurrent sessions, and one failed with a duplicate pg_type key. Resetting
// once here, before the workers start, avoids the race.
import * as db from './db';

export async function setup(): Promise<void> {
	await db.reset();
	// Only this process's pool; each test file opens its own.
	await db.shutdown();
}
