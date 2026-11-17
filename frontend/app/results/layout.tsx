import type { ReactNode } from 'react';
import { ResultsProvider } from './context';

export default function ResultsLayout({ children }: { children: ReactNode }) {
	return <ResultsProvider>{children}</ResultsProvider>;
}
