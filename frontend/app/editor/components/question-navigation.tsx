'use client';
import { useEditor } from '../context';

// Difficulty keeps the same fixed hues as the label in the question panel.
const DIFFICULTY_DOT_STYLES: Record<string, string> = {
	Easy: 'bg-green-600 dark:bg-green-400',
	Medium: 'bg-yellow-600 dark:bg-yellow-400',
	Hard: 'bg-red-600 dark:bg-red-400',
};

export default function QuestionNavigation() {
	const { currentQuestion, setCurrentQuestion, questions } = useEditor();

	return (
		<div className="mb-5 flex w-full gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
			{questions.map((question, index) => {
				const selected = question.question_id === currentQuestion?.question_id;
				return (
					<button
						key={question.question_id}
						onClick={() => setCurrentQuestion(question)}
						aria-current={selected ? 'true' : undefined}
						className={`lb-press flex h-10 flex-1 items-center justify-center gap-2 rounded-md font-medium ${
							selected ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
						}`}
					>
						{index + 1}
						<span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DIFFICULTY_DOT_STYLES[question.difficulty] ?? 'bg-line'}`} />
					</button>
				);
			})}
		</div>
	);
}
