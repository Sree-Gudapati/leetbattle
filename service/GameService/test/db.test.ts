import { afterEach, describe, expect, it, vi } from 'vitest';

// src/db.ts picks its pg Pool config via a ternary on INSTANCE_CONNECTION_NAME:
// set -> Cloud SQL unix socket host, unset -> local POSTGRES_HOST/PORT. Every
// other test file imports db.ts with that env var unset (local dev/CI), so
// only the "unset" branch has ever run. This file sets it before a fresh
// import (vi.resetModules so db.ts re-evaluates instead of reusing the
// already-cached pool) to exercise the Cloud SQL branch too.
describe('db pool config', () => {
	const originalInstanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

	afterEach(async () => {
		if (originalInstanceConnectionName === undefined) {
			delete process.env.INSTANCE_CONNECTION_NAME;
		} else {
			process.env.INSTANCE_CONNECTION_NAME = originalInstanceConnectionName;
		}
		vi.resetModules();
	});

	it('connects over the Cloud SQL unix socket when INSTANCE_CONNECTION_NAME is set', async () => {
		process.env.INSTANCE_CONNECTION_NAME = 'test-project:test-region:test-instance';
		vi.resetModules();
		const { pool, shutdown } = await import('../src/db');
		expect(pool.options.host).toBe('/cloudsql/test-project:test-region:test-instance');
		await shutdown();
	});
});
