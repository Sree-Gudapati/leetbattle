'use client';
import { FormEvent, useState } from 'react';
import { useTeamChat } from '../chat-context';

export default function TeamChat() {
	const { messages, send, error } = useTeamChat();
	const [draft, setDraft] = useState('');
	const canSend = draft.trim() !== '';

	const onSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!canSend) {
			return;
		}
		send(draft);
		setDraft('');
	};

	return (
		<section aria-label="Team chat" className="flex h-full flex-col bg-surface text-sm text-ink">
			<h2 className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
				Team chat
			</h2>

			{messages.length === 0 ? (
				<p className="flex-1 px-4 py-3 text-muted">No messages yet</p>
			) : (
				<ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
					{messages.map((message) => (
						<li key={message.id} className="leading-5">
							<span className="mr-2 font-medium text-primary">{message.displayName}</span>
							<span data-testid="chat-text" className="break-words">{message.text}</span>
						</li>
					))}
				</ul>
			)}

			{error && <p role="alert" className="border-t border-line px-4 pt-2 text-xs text-danger">{error}</p>}

			<form onSubmit={onSubmit} className="flex gap-2 border-t border-line px-4 py-2">
				<input
					type="text"
					aria-label="Message your team"
					placeholder="Message your team"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					className="min-w-0 flex-1 rounded-md border border-line bg-page px-3 py-1.5 text-ink placeholder:text-muted focus:border-primary focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!canSend}
					className="rounded-md bg-primary px-3 py-1.5 font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Send
				</button>
			</form>
		</section>
	);
}
