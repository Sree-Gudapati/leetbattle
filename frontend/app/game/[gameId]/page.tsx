'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import RequireAuth from '../../login/protected';
import { useAuth } from '../../login/context';
import HomeTopBar from '../../_home/components/topbar';
import PageLoader from '../../_shared/page-loader';
import { useLobbySocket } from '../../lobby/socket-context';
import type { TeamId } from '../../lobby/socket-context';
import { titleFromTaskId } from '../../editor/components/question-panel';
import { GameSocketProvider, useGameSocket } from '../socket-context';
import type { GamePlayer } from '../socket-context';

const TEAMS: { id: TeamId; name: string; nameColor: string }[] = [
	{ id: 'a', name: 'Team 1', nameColor: 'text-primary' },
	{ id: 'b', name: 'Team 2', nameColor: 'text-secondary' },
];

// 1200 -> "20:00"
function formatClock(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Counts down locally from the server's last `secondsRemaining`; every new
// game state resyncs it, so clients never drift far from the server's clock.
function Clock({ seconds }: { seconds: number }) {
	const [left, setLeft] = useState(seconds);

	useEffect(() => {
		setLeft(seconds);
		const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1_000);
		return () => clearInterval(timer);
	}, [seconds]);

	return <span className="font-mono text-[28px] font-bold leading-none text-ink">{formatClock(left)}</span>;
}

function Roster({ team, players, userId }: { team: typeof TEAMS[number]; players: GamePlayer[]; userId?: string }) {
	return (
		<section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
			<h2 className={`text-[20px] font-bold tracking-[-0.02em] ${team.nameColor}`}>{team.name}</h2>
			<ul className="flex flex-col gap-2" aria-label={`${team.name} players`}>
				{players.map((player) => (
					<li key={player.userId} className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-page px-4 py-2">
						<span className="flex items-baseline gap-2.5">
							<span className="text-[15px] font-medium">{player.displayName}</span>
							{player.userId === userId && <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">You</span>}
						</span>
						{!player.connected && <span className="text-[13px] font-medium text-muted">Reconnecting…</span>}
					</li>
				))}
			</ul>
		</section>
	);
}

function GameContent() {
	const { gameId } = useParams<{ gameId: string }>();
	const { user } = useAuth();
	const { connected, game, error, connect } = useGameSocket();
	const { disconnect: leaveLobby } = useLobbySocket();
	const joined = connected && game !== null;

	useEffect(() => {
		connect(gameId);
	}, [connect, gameId]);

	// The lobby connection has done its job once the player is in the match.
	useEffect(() => {
		if (joined) leaveLobby();
	}, [joined, leaveLobby]);

	return (
		<div className="flex min-h-screen flex-col bg-page font-sans text-ink">
			<PageLoader variant="pen" />
			<HomeTopBar />
			<main className="flex-1 px-5 pt-12 pb-16">
				<div className="mx-auto flex max-w-[1040px] flex-col gap-8">
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div className="flex flex-col gap-2">
							<h1 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.035em]">Match</h1>
							<p className="text-[15px] text-muted">Two teams, the same problems, twenty minutes.</p>
						</div>
						{joined && (
							<div className="flex items-center gap-6">
								<span className="font-mono text-sm font-semibold"><span className="text-primary">{game.scores.a}</span> – <span className="text-secondary">{game.scores.b}</span></span>
								<Clock seconds={game.secondsRemaining} />
							</div>
						)}
					</header>

					{error && (
						<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
							<span>{error.message}</span>
							<Link href="/lobby" className="font-semibold underline underline-offset-4">Back to lobby</Link>
						</div>
					)}

					{!joined && !error && <p role="status" aria-live="polite" className="text-sm text-muted">Joining match…</p>}

					{joined && (
						<>
							<div className="grid gap-5 md:grid-cols-2">
								{TEAMS.map((team) => (
									<Roster key={team.id} team={team} players={game.players.filter((player) => player.team === team.id)} userId={user?.id} />
								))}
							</div>

							<section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
								<h2 className="text-[20px] font-bold tracking-[-0.02em]">Problems</h2>
								<ul className="flex flex-col gap-2" aria-label="Problems">
									{game.problemPool.map((taskId) => (
										<li key={taskId} className="rounded-lg bg-page px-4 py-2 text-[15px] font-medium">{titleFromTaskId(taskId)}</li>
									))}
								</ul>
								<p className="text-xs text-muted">The shared team editor opens here once collaborative editing lands.</p>
							</section>
						</>
					)}
				</div>
			</main>
		</div>
	);
}

export default function GamePage() {
	return (
		<RequireAuth>
			<GameSocketProvider>
				<GameContent />
			</GameSocketProvider>
		</RequireAuth>
	);
}
