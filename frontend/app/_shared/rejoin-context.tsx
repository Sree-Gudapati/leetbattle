'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../login/context';
import { getToken } from '../login/controller';

const GAME_URL = process.env.NEXT_PUBLIC_GAME_URL ?? 'http://localhost:4004';

// What GameService's GET /game/:id answers for a player with an active match.
export interface RejoinMatch {
	gameId: string;
	socketUrl: string;
	gameRoute: string;
}

interface RejoinContextValue {
	match: RejoinMatch | null;
	// Forgets the match with `gameId`, e.g. once GameService says it has ended.
	clear: (_gameId: string) => void;
}

const RejoinContext = createContext<RejoinContextValue | null>(null);

// Asks GameService for the signed-in player's active match. Anything other
// than a match (no token, 404, network error) means there is nothing to rejoin.
async function findActiveMatch(userId: string): Promise<RejoinMatch | null> {
	const token = getToken();
	if (!token) return null;
	try {
		const res = await fetch(`${GAME_URL}/game/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) return null;
		return await res.json() as RejoinMatch;
	} catch {
		return null;
	}
}

// US-6-T-8: lives in the root layout so the game page can tell a rejoin from
// a plain visit, but the Rejoin Match button belongs to the lobby page only.
// The check runs each time the player opens the lobby, in the background so
// the page never waits on it; no other page checks or shows the button.
export function RejoinProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const pathname = usePathname();
	const router = useRouter();
	const [match, setMatch] = useState<RejoinMatch | null>(null);
	const userId = user?.id;
	const onLobby = pathname === '/lobby';

	useEffect(() => {
		if (!userId || !onLobby) return;
		let current = true;
		void findActiveMatch(userId).then((found) => {
			if (current) setMatch(found);
		});
		// Leaving the lobby (or a newer visit's check) replaces this one, so a slow answer can't overwrite it.
		return () => {
			current = false;
		};
	}, [userId, onLobby]);

	const clear = useCallback((gameId: string) => {
		setMatch((existing) => (existing?.gameId === gameId ? null : existing));
	}, []);

	const visibleMatch = userId ? match : null;

	return (
		<RejoinContext.Provider value={{ match: visibleMatch, clear }}>
			{children}
			{visibleMatch && onLobby && (
				<nav aria-label="Active match" className="fixed right-5 bottom-5 z-50">
					<button
						onClick={() => router.push(visibleMatch.gameRoute)}
						className="inline-flex h-11 items-center rounded-xl bg-ink px-[18px] font-bold text-page shadow-lg hover:opacity-85"
					>
						Rejoin Match
					</button>
				</nav>
			)}
		</RejoinContext.Provider>
	);
}

// The rejoin state, or null outside a RejoinProvider (e.g. a page rendered on its own in a test).
export function useRejoin(): RejoinContextValue | null {
	return useContext(RejoinContext);
}
