// Context contains the state of the app
// Instead of having to pass props around each of the widgets, just
// subscribe to them here!
'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../login/context';
import { getToken } from '../login/controller';
import { useOptionalLobbySocket } from '../lobby/socket-context';
import { APIService, parseTestCases, Problem, RunResult, SubmitResult, TestCase } from './controller';

export type LoadingAction = 'run' | 'submit' | null;

export interface EditorTab {
	id: string;
	name: string;
	code: string;
}

interface EditorWorkspace {
	tabs: EditorTab[];
	activeTabId: string;
}

const EDITOR_WORKSPACE_EVENT = 'editor:workspace:update';
const LOBBY_URL = process.env.NEXT_PUBLIC_LOBBY_URL ?? 'http://localhost:4003';

function createWorkspace(question: Problem): EditorWorkspace {
	return {
		tabs: [{
			id: 'tab-1',
			name: 'Tab 1',
			code: question.starter_code.replaceAll('\\n', '\n'),
		}],
		activeTabId: 'tab-1',
	};
}

function isEditorTab(value: unknown): value is EditorTab {
	if (!value || typeof value !== 'object') return false;
	const tab = value as Record<string, unknown>;
	return typeof tab.id === 'string'
		&& typeof tab.name === 'string'
		&& typeof tab.code === 'string';
}

function isEditorWorkspace(value: unknown): value is EditorWorkspace {
	if (!value || typeof value !== 'object') return false;
	const workspace = value as Record<string, unknown>;
	return Array.isArray(workspace.tabs)
		&& workspace.tabs.length > 0
		&& workspace.tabs.every(isEditorTab)
		&& typeof workspace.activeTabId === 'string'
		&& workspace.tabs.some((tab) => tab.id === workspace.activeTabId);
}

export interface EditorContextValue {
	questions: Problem[];
	currentQuestion: Problem | null;
	setCurrentQuestion: (_question: Problem) => void;
	testCases: TestCase[];
	tabs: EditorTab[];
	activeTabId: string;
	selectTab: (_tabId: string) => void;
	createTab: () => void;
	copyTab: (_tabId: string) => void;
	renameTab: (_tabId: string, _name: string) => void;
	removeTab: (_tabId: string) => void;
	code: string;
	setCode: (_code: string) => void;
	error: string | null;
	onRun: () => void;
	onSubmit: () => void;
	runResult: RunResult | null;
	submitResult: SubmitResult | null;
	loadingAction: LoadingAction;
	isLoading: boolean;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth();
	const lobbySocket = useOptionalLobbySocket();
	const [questions, setQuestions] = useState<Problem[]>([]);
	const [currentQuestion, setCurrentQuestion] = useState<Problem | null>(null);
	const [workspaces, setWorkspaces] = useState<Record<number, EditorWorkspace>>({});
	const [error, setError] = useState<string | null>(null);
	const [runResult, setRunResult] = useState<RunResult | null>(null);
	const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
	const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
	const socketRef = useRef<Socket | null>(null);
	const testCases = currentQuestion ? parseTestCases(currentQuestion.input_output) : [];
	const workspace = currentQuestion
		? workspaces[currentQuestion.question_id] ?? createWorkspace(currentQuestion)
		: { tabs: [], activeTabId: '' };
	const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? workspace.tabs[0];
	const code = activeTab?.code ?? '';

	const applyRemoteWorkspace = useCallback((payload: unknown) => {
		if (!payload || typeof payload !== 'object') return;
		const update = payload as Record<string, unknown>;
		if (!Number.isInteger(update.questionId) || !isEditorWorkspace(update.workspace)) return;
		setWorkspaces((current) => ({
			...current,
			[update.questionId as number]: update.workspace as EditorWorkspace,
		}));
	}, []);

	useEffect(() => {
		let socket = lobbySocket?.socket ?? null;
		let ownsSocket = false;

		if (lobbySocket) {
			socket = lobbySocket.connect();
		} else if (user) {
			socket = io(LOBBY_URL, {
				autoConnect: false,
				auth: {
					token: getToken(),
					displayName: user.name?.trim() || user.email.split('@')[0],
				},
			});
			socket.connect();
			ownsSocket = true;
		}

		if (!socket) return;
		socketRef.current = socket;
		socket.on(EDITOR_WORKSPACE_EVENT, applyRemoteWorkspace);

		return () => {
			socket.off?.(EDITOR_WORKSPACE_EVENT, applyRemoteWorkspace);
			if (socketRef.current === socket) socketRef.current = null;
			if (ownsSocket) socket.disconnect();
		};
	}, [applyRemoteWorkspace, lobbySocket?.connect, lobbySocket?.socket, user]);

	const updateWorkspace = useCallback((nextWorkspace: EditorWorkspace) => {
		if (!currentQuestion) return;
		const questionId = currentQuestion.question_id;
		setWorkspaces((current) => ({ ...current, [questionId]: nextWorkspace }));
		socketRef.current?.emit(EDITOR_WORKSPACE_EVENT, { questionId, workspace: nextWorkspace });
	}, [currentQuestion]);

	const setCode = useCallback((nextCode: string) => {
		if (!currentQuestion || !activeTab) return;
		updateWorkspace({
			...workspace,
			tabs: workspace.tabs.map((tab) => tab.id === activeTab.id ? { ...tab, code: nextCode } : tab),
		});
	}, [activeTab, currentQuestion, updateWorkspace, workspace]);

	const selectTab = useCallback((tabId: string) => {
		if (workspace.tabs.some((tab) => tab.id === tabId)) {
			updateWorkspace({ ...workspace, activeTabId: tabId });
		}
	}, [updateWorkspace, workspace]);

	const createTab = useCallback(() => {
		if (!currentQuestion) return;
		const nextIndex = workspace.tabs.length + 1;
		const tab: EditorTab = {
			id: `tab-${nextIndex}`,
			name: `Tab ${nextIndex}`,
			code: '',
		};
		updateWorkspace({
			tabs: [...workspace.tabs, tab],
			activeTabId: tab.id,
		});
	}, [currentQuestion, updateWorkspace, workspace]);

	const copyTab = useCallback((tabId: string) => {
		if (!currentQuestion) return;
		const source = workspace.tabs.find((tab) => tab.id === tabId);
		if (!source) return;
		const nextIndex = workspace.tabs.length + 1;
		const copy: EditorTab = {
			...source,
			id: `tab-${nextIndex}`,
			name: `Tab ${nextIndex}`,
		};
		updateWorkspace({ tabs: [...workspace.tabs, copy], activeTabId: copy.id });
	}, [currentQuestion, updateWorkspace, workspace]);

	const renameTab = useCallback((tabId: string, name: string) => {
		const nextName = name.trim();
		if (!nextName) return;
		updateWorkspace({
			...workspace,
			tabs: workspace.tabs.map((tab) => tab.id === tabId ? { ...tab, name: nextName } : tab),
		});
	}, [updateWorkspace, workspace]);

	const removeTab = useCallback((tabId: string) => {
		if (workspace.tabs.length < 2) return;
		const tabs = workspace.tabs.filter((tab) => tab.id !== tabId);
		const activeTabId = workspace.activeTabId === tabId ? tabs[0].id : workspace.activeTabId;
		updateWorkspace({ tabs, activeTabId });
	}, [updateWorkspace, workspace]);

	useEffect(() => {
		const api = new APIService();
		api
			.generate()
			.then((problems) => {
				setQuestions(problems);
				setCurrentQuestion(problems[0] ?? null);
			})
			.catch((err) => setError(err.message));
	}, []);

	const onRun = () => {
		if (!currentQuestion || loadingAction) {
			return;
		}
		setLoadingAction('run');
		const api = new APIService();
		api
			.run(code, testCases, currentQuestion.question_id)
			.then(setRunResult)
			.catch((err) => setError(err.message))
			.finally(() => setLoadingAction(null));
	};

	const onSubmit = () => {
		if (!currentQuestion || loadingAction) {
			return;
		}
		setLoadingAction('submit');
		const api = new APIService();
		api
			.submit(currentQuestion.question_id, code)
			.then(setSubmitResult)
			.catch((err) => setError(err.message))
			.finally(() => setLoadingAction(null));
	};

	return (
		<EditorContext.Provider
			value={{
				questions,
				currentQuestion,
				setCurrentQuestion,
				testCases,
				tabs: workspace.tabs,
				activeTabId: workspace.activeTabId,
				selectTab,
				createTab,
				copyTab,
				renameTab,
				removeTab,
				code,
				setCode,
				error,
				onRun,
				onSubmit,
				runResult,
				submitResult,
				loadingAction,
				isLoading: loadingAction !== null,
			}}
		>
			{children}
		</EditorContext.Provider>
	);
}

export function useEditor(): EditorContextValue {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error('useEditor must be used within an EditorProvider');
	}
	return context;
}
