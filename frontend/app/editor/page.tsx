import Monaco from './components/monaco';
import CodeTabs from './components/code-tabs';
import QuestionPanel from './components/question-panel';
import TestCasesPanel from './components/test-cases-panel';
import SubmitBar from './components/submit-bar';
import ResultsPanel from './components/results-panel';
import HomeTopBar from '../_home/components/topbar';
import Scoreboard from './components/scoreboard';
import { EditorProvider } from './context';
import { MatchProvider } from './match-context';
import RequireAuth from '../login/protected';
import PageLoader from '../_shared/page-loader';

export default function editor() {
	return (
		<RequireAuth>
			<EditorProvider>
				<MatchProvider>
					<div>
						<PageLoader variant="pen" />
						<HomeTopBar />
						<Scoreboard />
						<div className="flex h-screen bg-page font-sans">

							<div className="w-1/2 border-r border-line">
								<QuestionPanel />
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
				</MatchProvider>
			</EditorProvider>
		</RequireAuth>
	);
}