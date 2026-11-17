// The screen where each player bans one question, shown on the game page while
// the game is banning. It only renders what it is given: the pool (with who
// banned what) comes from GameService's `game:state`, and `onBan` sends the
// ban to the server.
'use client';

import { useAuth } from '../../login/context';
import type { PoolProblem } from '../socket-context';

const CARD = 'flex min-h-[168px] w-full flex-col justify-between gap-5 rounded-xl p-5 text-left';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const inWords = (count: number) => NUMBER_WORDS[count] ?? String(count);
const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function BanIcon() {
	return (
		<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
			<circle cx="8" cy="8" r="6" />
			<path d="M3.8 12.2l8.4-8.4" />
		</svg>
	);
}

// The number and topics of a question. A banned question's topics are struck through.
function QuestionTopics({ position, problem }: { position: number; problem: PoolProblem }) {
	const chip = problem.bannedBy
		? 'border border-line font-medium text-muted line-through'
		: 'bg-raised font-semibold';
	return (
		<span className="flex flex-col gap-3.5">
			<span data-testid="question-label" className="text-sm font-medium text-muted">Question {position}</span>
			<span className="flex flex-wrap gap-2">
				{problem.topics.map((topic) => (
					<span key={topic} data-testid="topic" className={`rounded-full px-3 py-1.5 text-[15px] ${chip}`}>{topic}</span>
				))}
			</span>
		</span>
	);
}

interface BanScreenProps {
	problems: PoolProblem[];
	// One ban per player, so this is also the number of bans the match takes.
	playerCount: number;
	onBan: (_questionId: number) => void;
}

export default function BanScreen({ problems, playerCount, onBan }: BanScreenProps) {
	const { user } = useAuth();

	const banners = problems.flatMap((problem) => (problem.bannedBy ? [problem.bannedBy] : []));
	const hasBanned = banners.some((banner) => banner.userId === user?.id);
	// One marker per ban: Team 1's bans first, then Team 2's, then the bans still to come.
	const markers = [
		...banners.filter((banner) => banner.team === 'a').map(() => 'a'),
		...banners.filter((banner) => banner.team === 'b').map(() => 'b'),
		...Array<string>(playerCount).fill('empty'),
	].slice(0, playerCount);
	const leftInPlay = Math.max(0, problems.length - playerCount);

	return (
		<section className="flex flex-col gap-8">
			<header className="flex flex-col gap-2">
				<h2 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.035em]">Ban a question</h2>
				<p className="text-[15px] text-muted">
					{capitalise(inWords(problems.length))} questions, shown by topic only. Every player bans one, and the match is played on the {inWords(leftInPlay)} that are left.
				</p>
			</header>

			<div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-line pb-5">
				<div className="flex items-center gap-3">
					<div aria-hidden="true" className="flex gap-1">
						{markers.map((marker, i) => <span key={i} data-seat={marker} className="lb-seat-pip" />)}
					</div>
					<span className="text-sm font-semibold">{banners.length} of {playerCount} bans made</span>
				</div>
				<p role="status" aria-live="polite" className="text-sm text-muted">
					{hasBanned ? 'Your ban is in. Waiting for the other players.' : 'You have 1 ban left. Choose a question to remove.'}
				</p>
			</div>

			<ul aria-label="Questions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{problems.map((problem, i) => {
					const banner = problem.bannedBy;
					const topics = <QuestionTopics position={i + 1} problem={problem} />;

					if (banner) {
						return (
							<li key={problem.questionId} className={`${CARD} border border-dashed border-line`}>
								{topics}
								<span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
									<BanIcon />
									Banned by{' '}
									<span className={banner.team === 'a' ? 'text-primary' : 'text-secondary'}>
										{banner.userId === user?.id ? 'you' : banner.displayName}
									</span>
								</span>
							</li>
						);
					}
					if (hasBanned) {
						return (
							<li key={problem.questionId} className={`${CARD} border border-line bg-surface`}>
								{topics}
								<span className="text-[13px] font-medium text-muted">Still in play</span>
							</li>
						);
					}
					return (
						<li key={problem.questionId} className="flex">
							<button onClick={() => onBan(problem.questionId)} className={`lb-press ${CARD} border border-line bg-surface hover:bg-raised`}>
								{topics}
								<span className="flex items-center gap-2 text-[13px] font-semibold text-danger">
									<BanIcon />
									Ban this question
								</span>
							</button>
						</li>
					);
				})}
			</ul>

			<p className="flex flex-wrap gap-6 text-[13px] text-muted">
				<span className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />Team 1</span>
				<span className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-secondary" />Team 2</span>
			</p>
		</section>
	);
}
