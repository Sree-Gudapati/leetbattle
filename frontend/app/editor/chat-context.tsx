// Holds the team chat for the match screen.
// With a game socket (US-3-T-2), `send` emits `chat:send` to GameService.
// Without one, messages live in local state only.
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../login/context';

export interface ChatMessage {
	id: string;
	userId: string;
	displayName: string;
	text: string;
}

export interface ChatContextValue {
	messages: ChatMessage[];
	send: (_text: string) => void;
	// Why GameService refused the last message (e.g. "Message too long"), if it did.
	error: string | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
	children,
	initialMessages = [],
	socket = null,
}: {
	children: ReactNode;
	initialMessages?: ChatMessage[];
	// The match's game socket; null outside a match.
	socket?: Socket | null;
}) {
	const { user } = useAuth();
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
	const [error, setError] = useState<string | null>(null);

	// GameService sends each team message (the player's own included) as `chat:message`.
	useEffect(() => {
		if (!socket) return;
		const onMessage = (message: ChatMessage) => setMessages((current) => [...current, message]);
		socket.on('chat:message', onMessage);
		return () => {
			socket.off('chat:message', onMessage);
		};
	}, [socket]);

	const send = (text: string) => {
		// Over the socket, the message only shows once GameService sends it back.
		if (socket) {
			// GameService answers only to refuse a message, with { error }.
			socket.emit('chat:send', { text: text.trim() }, (response?: { error?: string }) => {
				if (response?.error) setError(response.error);
			});
			return;
		}
		setMessages((current) => [
			...current,
			{
				id: `local-${current.length}`,
				userId: user?.id ?? '',
				displayName: user?.name ?? '',
				text: text.trim(),
			},
		]);
	};

	return <ChatContext.Provider value={{ messages, send, error }}>{children}</ChatContext.Provider>;
}

export function useTeamChat(): ChatContextValue {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useTeamChat must be used within a ChatProvider');
	}
	return context;
}
