// Holds the team chat for the match screen.
// Messages live in local state for now; the match websocket (US-3-T-2) will
// replace `send` and feed incoming messages without the panel changing.
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
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
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
	children,
	initialMessages = [],
}: {
	children: ReactNode;
	initialMessages?: ChatMessage[];
}) {
	const { user } = useAuth();
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

	const send = (text: string) => {
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

	return <ChatContext.Provider value={{ messages, send }}>{children}</ChatContext.Provider>;
}

export function useTeamChat(): ChatContextValue {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useTeamChat must be used within a ChatProvider');
	}
	return context;
}
