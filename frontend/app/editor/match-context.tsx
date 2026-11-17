// The live match state shown on the match screen: team scores, time left and
// recent submissions.
// UI only for now: everything is sample data and the timer just counts down
// locally. Once GameService has its websocket, this provider is where the live
// scores, timer and submissions come in from the server.
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface MatchSubmission {
	id: string;
	displayName: string;
	team: 'a' | 'b';
	question: number;
	accepted: boolean;
	// Points the submission earned; 0 when it was not accepted.
	points: number;
}

export interface MatchContextValue {
	scores: { a: number; b: number };
	secondsLeft: number;
	// Newest first.
	submissions: MatchSubmission[];
}

const SAMPLE_SCORES = { a: 120, b: 80 };
const SAMPLE_SECONDS_LEFT = 754;
const SAMPLE_SUBMISSIONS: MatchSubmission[] = [
	{ id: 's1', displayName: 'Ada', team: 'a', question: 3, accepted: true, points: 50 },
	{ id: 's2', displayName: 'Alan', team: 'b', question: 5, accepted: false, points: 0 },
	{ id: 's3', displayName: 'Grace', team: 'a', question: 1, accepted: true, points: 30 },
	{ id: 's4', displayName: 'Edsger', team: 'b', question: 2, accepted: true, points: 40 },
	{ id: 's5', displayName: 'Ada', team: 'a', question: 4, accepted: false, points: 0 },
	{ id: 's6', displayName: 'Alan', team: 'b', question: 1, accepted: true, points: 30 },
];

const MatchContext = createContext<MatchContextValue | null>(null);

export function MatchProvider({ children }: { children: ReactNode }) {
	const [secondsLeft, setSecondsLeft] = useState(SAMPLE_SECONDS_LEFT);

	useEffect(() => {
		const timer = setInterval(() => {
			setSecondsLeft((s) => Math.max(0, s - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	return (
		<MatchContext.Provider value={{ scores: SAMPLE_SCORES, secondsLeft, submissions: SAMPLE_SUBMISSIONS }}>
			{children}
		</MatchContext.Provider>
	);
}

export function useMatch(): MatchContextValue {
	const context = useContext(MatchContext);
	if (!context) {
		throw new Error('useMatch must be used within a MatchProvider');
	}
	return context;
}
