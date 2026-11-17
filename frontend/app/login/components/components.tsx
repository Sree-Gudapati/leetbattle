import { useId, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center bg-page px-4 font-sans">
			<div className="flex w-full max-w-[400px] flex-col gap-4 rounded-xl border border-line bg-surface p-8">
				<h1 className="text-2xl font-bold text-ink">{title}</h1>
				{children}
			</div>
		</div>
	);
}

const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z';

function EyeIcon({ shown }: { shown: boolean }) {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d={EYE} />
			<circle cx="12" cy="12" r="3" />
			{shown && <line x1="4" y1="20" x2="20" y2="4" />}
		</svg>
	);
}

export function AuthField({
	label,
	type,
	...inputProps
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
	const id = useId();
	const [shown, setShown] = useState(false);
	const isPassword = type === 'password';
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
			<div className="relative">
				<input
					{...inputProps}
					id={id}
					type={isPassword && shown ? 'text' : type}
					className={`h-[46px] w-full rounded-lg border border-line bg-page px-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 ${isPassword ? 'pr-11' : ''}`}
				/>
				{isPassword && (
					<button
						type="button"
						aria-label={shown ? 'Hide password' : 'Show password'}
						aria-pressed={shown}
						onClick={() => setShown(!shown)}
						className="absolute right-0 top-0 flex h-[46px] w-11 items-center justify-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
					>
						<EyeIcon shown={shown} />
					</button>
				)}
			</div>
		</div>
	);
}

export function AuthSubmitButton({ pending, pendingLabel, children }: {
	pending: boolean;
	pendingLabel: string;
	children: ReactNode;
}) {
	return (
		<button
			type="submit"
			disabled={pending}
			className="h-[46px] w-full rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary disabled:opacity-50"
		>
			{pending ? pendingLabel : children}
		</button>
	);
}

// A quiet text button (Forgot password?, Need an account?, Back to log in).
export function AuthTextButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			{...props}
			className={`self-center text-sm text-muted hover:text-ink hover:underline focus-visible:underline ${className}`}
		/>
	);
}

// A circle and tick that draw themselves.
export function AuthCheck() {
	return (
		<svg className="lb-auth-check" width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<circle cx="22" cy="22" r="19" />
			<path d="M14 22.5l5.5 5.5L30.5 17" />
		</svg>
	);
}

export interface AuthStatus {
	type: 'success' | 'error';
	text: string;
}

export function AuthMessage({ status }: { status?: AuthStatus | null }) {
	if (!status) {
		return null;
	}
	const color = status.type === 'error' ? 'text-danger' : 'text-green-600 dark:text-green-400';
	return <p className={`text-sm ${color}`}>{status.text}</p>;
}
