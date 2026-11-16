'use client';
import { useEditor } from '../context';

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
						className={`lb-press flex h-10 flex-1 items-center justify-center rounded-md font-medium ${
							selected ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
						}`}
					>
						{index + 1}
					</button>
				);
			})}
		</div>
	);
}
