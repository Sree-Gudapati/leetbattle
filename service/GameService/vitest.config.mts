import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Resets the database schema once for the whole run (see test/global-setup.ts).
		globalSetup: ['./test/global-setup.ts'],
		coverage: {
			provider: 'v8',
			thresholds: {
				lines: 80,
				statements: 80,
				functions: 80,
				branches: 80,
			},
		},
	},
});
