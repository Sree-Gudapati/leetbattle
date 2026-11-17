'use client';
import { useRouter } from 'next/navigation';
import { SubmitEvent, useEffect, useState } from 'react';
import { useAuth } from './context';
import PageLoader from '../_shared/page-loader';
import HomeTopBar from '../_home/components/topbar';
import { AuthAPIService } from './controller';
import { AuthCard, AuthCheck, AuthField, AuthMessage, AuthSubmitButton, AuthTextButton } from './components/components';

type Mode = 'login' | 'signup' | 'forgot' | 'sent';

export default function LoginPage() {
	const { login, signup, user, isLoading } = useAuth();
	const router = useRouter();
	const [mode, setMode] = useState<Mode>('login');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = async (e: SubmitEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);
		try {
			if (mode === 'forgot') {
				await new AuthAPIService().requestPasswordReset(email);
				setMode('sent');
				return;
			}
			if (mode === 'signup') {
				await signup(email, password, name);
			} else {
				await login(email, password);
			}
			router.push('/');
		} catch (err) {
			setError(err instanceof Error ? err.message : `failed to ${mode === 'signup' ? 'sign up' : mode === 'forgot' ? 'send the reset link' : 'log in'}`);
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (user) {
			router.push('/');
		}
	}, [user, router]);

	if (isLoading || user) {
		return null;
	}

	const backToLogin = () => {
		setError(null);
		setMode('login');
	};

	if (mode === 'sent') {
		return (
			<>
				<PageLoader variant="pen" />
				<HomeTopBar />
				<AuthCard title="Check your email">
					<div className="flex flex-col gap-4">
						<AuthCheck />
						<p role="status" className="text-sm text-muted">
							If an account exists for that address, a reset link is on its way. The link works for 30 minutes.
						</p>
						<AuthTextButton onClick={backToLogin}>Back to log in</AuthTextButton>
					</div>
				</AuthCard>
			</>
		);
	}

	if (mode === 'forgot') {
		return (
			<>
				<PageLoader variant="pen" />
				<HomeTopBar />
				<AuthCard title="Reset your password">
					<form onSubmit={onSubmit} className="flex flex-col gap-4">
						<p className="text-sm text-muted">Enter your email and we will send you a link to choose a new password.</p>
						<AuthField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
						<AuthMessage status={error ? { type: 'error', text: error } : null} />
						<AuthSubmitButton pending={isSubmitting} pendingLabel="Sending…">Send reset link</AuthSubmitButton>
						<AuthTextButton onClick={backToLogin}>Back to log in</AuthTextButton>
					</form>
				</AuthCard>
			</>
		);
	}

	return (
		<>
			<PageLoader variant="pen" />
			<HomeTopBar />
			<AuthCard title={mode === 'signup' ? 'Sign up' : 'Log in'}>
				<form onSubmit={onSubmit} className="flex flex-col gap-4">
					{mode === 'signup' && (
						<AuthField
							label="Name"
							type="text"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					)}
					<AuthField
						label="Email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<AuthField
						label="Password"
						type="password"
						required
						minLength={mode === 'signup' ? 8 : undefined}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
					{mode === 'login' && (
						<AuthTextButton
							className="-mt-2 self-end"
							onClick={() => {
								setError(null);
								setMode('forgot');
							}}
						>
							Forgot password?
						</AuthTextButton>
					)}

					<AuthMessage status={error ? { type: 'error', text: error } : null} />

					<AuthSubmitButton pending={isSubmitting} pendingLabel={mode === 'signup' ? 'Signing up…' : 'Logging in…'}>
						{mode === 'signup' ? 'Sign up' : 'Log in'}
					</AuthSubmitButton>

					<AuthTextButton
						onClick={() => {
							setError(null);
							setMode(mode === 'signup' ? 'login' : 'signup');
						}}
					>
						{mode === 'signup' ? 'Already have an account?' : 'Need an account?'}
					</AuthTextButton>
				</form>
			</AuthCard>
		</>
	);
}
