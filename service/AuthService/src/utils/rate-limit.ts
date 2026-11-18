// A fixed-window counter kept in memory (US-5-T-13): at most `max` hits per
// key in each `windowMs`. Each AuthService instance counts on its own, which
// is enough to stop one client from flooding the reset endpoints.
const limiters: RateLimiter[] = [];

export class RateLimiter {
	private readonly windows = new Map<string, { start: number; count: number }>();
	private readonly max: number;
	private readonly windowMs: number;

	constructor(max: number, windowMs: number) {
		this.max = max;
		this.windowMs = windowMs;
		limiters.push(this);
	}

	// Counts a hit for `key` and says whether it is still within the limit.
	hit(key: string): boolean {
		const now = Date.now();
		const window = this.windows.get(key);
		if (!window || now - window.start >= this.windowMs) {
			this.windows.set(key, { start: now, count: 1 });
			return true;
		}
		window.count += 1;
		return window.count <= this.max;
	}

	clear(): void {
		this.windows.clear();
	}
}

// Empties every limiter; tests start each case with fresh limits.
export function resetRateLimits(): void {
	for (const limiter of limiters) limiter.clear();
}
