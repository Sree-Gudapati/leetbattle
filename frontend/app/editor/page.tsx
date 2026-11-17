import TeamChat from './components/team-chat';
import EditorLayout from './components/editor-layout';
import HomeTopBar from '../_home/components/topbar';
import Scoreboard from './components/scoreboard';
import { EditorProvider } from './context';
import { ChatProvider } from './chat-context';
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
						<EditorLayout
							belowQuestion={(
								<ChatProvider>
									<TeamChat />
								</ChatProvider>
							)}
						/>
					</div>
				</MatchProvider>
			</EditorProvider>
		</RequireAuth>
	);
}
