// The final scores for the end-of-match screen.
// UI only for now: the scores and the player's team are sample data. Once
// GameService can report a finished match, this provider is where the live
// final scores and the signed-in player's team come in.
'use client';
import { createContext, useContext, ReactNode } from 'react';

export type TeamId = 'a' | 'b';

export interface ResultsContextValue {
	// Final points for each team. Team `a` is "Team 1", team `b` is "Team 2".
	scores: Record<TeamId, number>;
	// The team the signed-in player played on.
	yourTeam: TeamId;
}

const SAMPLE_RESULTS: ResultsContextValue = { scores: { a: 150, b: 90 }, yourTeam: 'a' };

const ResultsContext = createContext<ResultsContextValue | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
	return <ResultsContext.Provider value={SAMPLE_RESULTS}>{children}</ResultsContext.Provider>;
}

export function useResults(): ResultsContextValue {
	const context = useContext(ResultsContext);
	if (!context) {
		throw new Error('useResults must be used within a ResultsProvider');
	}
	return context;
}
