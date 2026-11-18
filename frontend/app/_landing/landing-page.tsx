import Link from 'next/link';
import HomeNav from '../_shared/home-nav';
import Wordmark from '../_shared/wordmark';
import Intro from './intro';
import MatchDemo from './match-demo';
import ScrollSections from './scroll-sections';

export default function LandingPage() {
	return (
		<div className="relative flex-1 overflow-hidden">
			<Intro />

			<div className="mx-auto max-w-[1180px] px-6 sm:px-8">
				<nav className="flex flex-wrap items-center justify-between gap-4 py-7">
					<Link href="/" className="text-xl font-extrabold tracking-[-0.02em]">
						<Wordmark />
					</Link>
					<div className="flex flex-wrap items-center gap-6 text-[15px] text-muted">
						<HomeNav />
					</div>
				</nav>

				{/* US-5-T-14: the wordmark draws in behind the page loader's pen tip, which
				    then stays after it as a blinking cursor (lb-hero-* in globals.css). */}
				<section className="flex flex-col items-center gap-7 pt-16 pb-12 text-center sm:pt-22">
					<h1 className="relative m-0 text-[clamp(64px,10vw,140px)] font-black leading-none tracking-[-0.04em]">
						<span className="lb-hero-word block">Leet<span className="text-primary">Battle</span></span>
						<span data-testid="pen-tip" aria-hidden="true" className="lb-hero-tip" />
					</h1>
					<p className="lb-reveal m-0 text-xl text-muted" style={{ '--d': '0.6s' } as React.CSSProperties}>
						Team coding battles, live in your browser
					</p>
					<div className="lb-reveal flex flex-wrap justify-center gap-3" style={{ '--d': '0.75s' } as React.CSSProperties}>
						<Link href="/login" className="inline-flex h-[54px] items-center gap-2.5 rounded-[14px] bg-primary px-[26px] text-base font-bold text-on-primary hover:opacity-90">
							Find a match
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M5 12h14M13 6l6 6-6 6" />
							</svg>
						</Link>
						<Link href="/lobby?private=1" className="inline-flex h-[54px] items-center rounded-[14px] border border-line px-6 text-base font-semibold hover:bg-raised">
							Private lobby
						</Link>
					</div>
				</section>

				<div className="mx-auto max-w-[1100px] pt-6 pb-20">
					<MatchDemo />
				</div>

				<ScrollSections />

				<footer className="flex flex-wrap justify-between gap-4 border-t border-line pt-7 pb-10 text-sm text-muted">
					<span><Wordmark /></span>
					<span>UC Santa Cruz · Baskin Engineering</span>
				</footer>
			</div>
		</div>
	);
}
