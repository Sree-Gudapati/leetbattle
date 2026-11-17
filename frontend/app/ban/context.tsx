// The questions and bans for the ban screen.
// UI only for now: the questions are sample data and `ban` does nothing. Once
// GameService has its websocket, this provider is where the live state comes
// in (questions and bans from the server) and where `ban` sends the request.
'use client';
import { createContext, useContext, ReactNode } from 'react';

export type TeamId = 'a' | 'b';

export interface BanQuestion {
	// Identifies the question to the server. Never shown: players see topics only.
	id: string;
	topics: string[];
	// The player who banned the question, or null while it is still in play.
	bannedBy: { userId: string; displayName: string; team: TeamId } | null;
}

export interface BanContextValue {
	questions: BanQuestion[];
	ban: (_questionId: string) => void;
}

const SAMPLE_TOPICS = [
	['Array', 'Hash Table'],
	['String', 'Two Pointers'],
	['Dynamic Programming'],
	['Binary Search', 'Array'],
	['Graph', 'Breadth-First Search'],
	['Stack', 'String'],
	['Tree', 'Depth-First Search'],
	['Greedy', 'Sorting'],
	['Linked List', 'Recursion'],
];

const SAMPLE_QUESTIONS: BanQuestion[] = SAMPLE_TOPICS.map((topics, i) => ({
	id: `sample-${i + 1}`,
	topics,
	bannedBy: null,
}));

const BanContext = createContext<BanContextValue | null>(null);

export function BanProvider({ children }: { children: ReactNode }) {
	// Not implemented yet: banning waits for the GameService websocket.
	const ban = () => undefined;

	return <BanContext.Provider value={{ questions: SAMPLE_QUESTIONS, ban }}>{children}</BanContext.Provider>;
}

export function useBan(): BanContextValue {
	const context = useContext(BanContext);
	if (!context) {
		throw new Error('useBan must be used within a BanProvider');
	}
	return context;
}
