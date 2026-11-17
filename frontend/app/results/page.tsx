'use client';

import Link from 'next/link';
import RequireAuth from '../login/protected';
import HomeTopBar from '../_home/components/topbar';
import { useResults } from './context';

const BUTTON = 'lb-press inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold';

const TEAMS = [
	{ id: 'a', name: 'Team 1', color: 'text-primary' },
	{ id: 'b', name: 'Team 2', color: 'text-secondary' },
] as const;

function ResultsContent() {
	const { scores, yourTeam } = useResults();

	const winner = scores.a === scores.b ? null : scores.a > scores.b ? 'a' : 'b';
	const headline = winner ? `${winner === 'a' ? 'Team 1' : 'Team 2'} wins` : 'Draw';

	return (
		<div className="flex min-h-screen flex-col bg-page font-sans text-ink">
			<HomeTopBar />
			<main className="flex-1 px-5 pt-12 pb-16">
				<div className="mx-auto flex max-w-[640px] flex-col items-center gap-8 text-center">
					<header className="flex flex-col gap-2">
						{winner && <p className="text-sm font-semibold text-muted">{winner === yourTeam ? 'Victory' : 'Defeat'}</p>}
						<h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.035em]">{headline}</h1>
					</header>

					<div className="grid w-full grid-cols-2 gap-4">
						{TEAMS.map((team) => (
							<div key={team.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6">
								<span className="text-sm font-medium text-muted">{team.name}</span>
								<span data-testid={`score-${team.id}`} className={`text-5xl font-extrabold ${team.color}`}>{scores[team.id]}</span>
							</div>
						))}
					</div>

					<div className="flex flex-wrap justify-center gap-3">
						<Link href="/lobby" className={`${BUTTON} bg-primary text-on-primary`}>Play again</Link>
						<Link href="/" className={`${BUTTON} border border-line bg-surface hover:bg-raised`}>Back to home</Link>
					</div>
				</div>
			</main>
		</div>
	);
}

export default function ResultsPage() {
	return (
		<RequireAuth>
			<ResultsContent />
		</RequireAuth>
	);
}
