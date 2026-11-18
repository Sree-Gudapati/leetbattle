import { afterAll, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import TestAgent from 'supertest/lib/agent';

import * as http from 'http';
import * as db from './db';
import app from '../src/app';
import { resetRateLimits } from '../src/middleware';

let server: http.Server<
  typeof http.IncomingMessage,
  typeof http.ServerResponse
>;

export let request: TestAgent;

beforeAll(async () => {
	server = http.createServer(app);
	server.listen();
	request = supertest(server);
	return db.reset();
});

// The reset endpoints are rate limited (US5-Task13), and every test request
// comes from the same IP, so each test starts with empty limits.
beforeEach(() => {
	resetRateLimits();
});

afterAll(() => {
	db.shutdown();
	server.close();
});
