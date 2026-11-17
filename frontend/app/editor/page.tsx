import Monaco from './components/monaco';
import CodeTabs from './components/code-tabs';
import QuestionPanel from './components/question-panel';
import TestCasesPanel from './components/test-cases-panel';
import SubmitBar from './components/submit-bar';
import ResultsPanel from './components/results-panel';
import TeamChat from './components/team-chat';
import HomeTopBar from '../_home/components/topbar';
import { EditorProvider } from './context';
import { ChatProvider } from './chat-context';
import RequireAuth from '../login/protected';
import PageLoader from '../_shared/page-loader';

export default function editor() {
	return (
		<RequireAuth>
			<EditorProvider>
				<div>
					<PageLoader variant="pen" />
					<HomeTopBar />
					<div className="flex h-screen bg-page font-sans">

						<div className="flex w-1/2 flex-col border-r border-line">
							<div className="min-h-0 flex-1">
								<QuestionPanel />
							</div>
							<div className="h-64 shrink-0 border-t border-line">
								<ChatProvider>
									<TeamChat />
								</ChatProvider>
							</div>
						</div>

						<div className="flex w-1/2 flex-col">
							<div className="flex h-3/5 min-h-0 flex-col">
								<CodeTabs />
								<div className="min-h-0 flex-1">
									<Monaco />
								</div>
							</div>
							<SubmitBar />
							<ResultsPanel />
							<div className="h-2/5 min-h-0 border-t border-line">
								<TestCasesPanel />
							</div>
						</div>
					</div>
				</div>
			</EditorProvider>
		</RequireAuth>
	);
}