'use client';
import { useMatch } from '../match-context';

const MAX_SUBMISSIONS = 5;

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Scoreboard() {
	const { scores, secondsLeft, submissions } = useMatch();
	const recent = submissions.slice(0, MAX_SUBMISSIONS);

	return (
		<section aria-label="Scoreboard" className="flex items-center gap-6 border-b border-line bg-surface px-4 py-2 text-ink">
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted">Team 1</span>
				<span data-testid="score-a" className="text-xl font-semibold text-primary">{scores.a}</span>
			</div>
			<div className="flex flex-col items-center">
				<span className="text-xs text-muted">Time left</span>
				<span className="font-mono text-lg">{formatTime(secondsLeft)}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted">Team 2</span>
				<span data-testid="score-b" className="text-xl font-semibold text-secondary">{scores.b}</span>
			</div>
			<div className="ml-auto text-sm">
				{recent.length === 0 ? (
					<p className="text-muted">No submissions yet</p>
				) : (
					<ul className="flex flex-col gap-0.5">
						{recent.map((s) => (
							<li key={s.id} className="flex items-center gap-2">
								<span>{s.displayName}</span>
								<span className="text-muted">Question {s.question}</span>
								{s.accepted ? (
									<>
										<span className="text-primary">Accepted</span>
										<span className="text-primary">+{s.points}</span>
									</>
								) : (
									<span className="text-danger">Wrong answer</span>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
