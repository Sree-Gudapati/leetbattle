'use client';
import type { GamePlayer } from '../socket-context';

interface WorkspaceSwitcherProps {
	// The viewer's teammates (own team, excluding the viewer); never the other team.
	teammates: GamePlayer[];
	// null means the viewer's own, editable workspace.
	viewedUserId: string | null;
	onSelect: (_userId: string | null) => void;
}

const TAB = 'h-8 max-w-48 truncate rounded-md px-3 text-xs font-medium';
const SELECTED = 'bg-raised text-ink';
const UNSELECTED = 'text-muted hover:bg-raised hover:text-ink';

export default function WorkspaceSwitcher({ teammates, viewedUserId, onSelect }: WorkspaceSwitcherProps) {
	return (
		<div role="tablist" aria-label="Workspace" className="flex h-10 shrink-0 items-center gap-1 border-b border-line bg-page px-2">
			<button
				type="button"
				role="tab"
				aria-selected={viewedUserId === null}
				onClick={() => onSelect(null)}
				className={`${TAB} ${viewedUserId === null ? SELECTED : UNSELECTED}`}
			>
				You
			</button>
			{teammates.map((teammate) => (
				<button
					key={teammate.userId}
					type="button"
					role="tab"
					aria-selected={viewedUserId === teammate.userId}
					onClick={() => onSelect(teammate.userId)}
					className={`${TAB} ${viewedUserId === teammate.userId ? SELECTED : UNSELECTED}`}
				>
					{teammate.displayName}
				</button>
			))}
		</div>
	);
}
