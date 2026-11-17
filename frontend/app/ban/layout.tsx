import type { ReactNode } from 'react';
import { BanProvider } from './context';

export default function BanLayout({ children }: { children: ReactNode }) {
	return <BanProvider>{children}</BanProvider>;
}
