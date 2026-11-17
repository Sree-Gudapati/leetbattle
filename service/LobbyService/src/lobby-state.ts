export type TeamId = 'a' | 'b';

export interface LobbyPlayer {
	userId: string;
	displayName: string;
	team: TeamId | null;
	connected: boolean;
	ready: boolean;
}

export interface LobbySnapshot {
	players: LobbyPlayer[];
	playerCount: number;
	readyCount: number;
	canReady: boolean;
	readyToStart: boolean;
	teamSize: number;
	hostId: string | null;
}

export interface LobbyReadiness {
	lobbyId: 'main';
	players: LobbyPlayer[];
}

export interface LobbyStore {
	loadMembers(): Promise<Pick<LobbyPlayer, 'userId' | 'displayName' | 'team'>[]>;
	addMember(_userId: string, _displayName: string): Promise<void>;
	removeMember(_userId: string): Promise<void>;
	setName(_userId: string, _displayName: string): Promise<void>;
	setTeam(_userId: string, _team: TeamId): Promise<void>;
	clearTeam(_userId: string): Promise<void>;
}

export class LobbyError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = 'LobbyError';
	}
}

interface MemberRecord {
	player: LobbyPlayer;
	disconnectTimer?: ReturnType<typeof setTimeout>;
}

export const MAX_TEAM_SIZE = 3;
const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export class LobbyState {
	private readonly members = new Map<string, MemberRecord>();
	private readonly connectedUsers = new Set<string>();
	private readonly disconnectGraceMs: number;
	private readonly onChange: () => void;
	private readonly store?: LobbyStore;
	private teamSize = MAX_TEAM_SIZE;

	constructor(disconnectGraceMs = DEFAULT_DISCONNECT_GRACE_MS, onChange: () => void = () => undefined, store?: LobbyStore) {
		this.disconnectGraceMs = disconnectGraceMs;
		this.onChange = onChange;
		this.store = store;
	}

	async initialize(): Promise<void> {
		if (!this.store) return;
		const members = await this.store.loadMembers();
		for (const player of members) {
			this.members.set(player.userId, { player: { ...player, connected: false, ready: false } });
			this.scheduleDisconnectRemoval(player.userId);
		}
	}

	async connect(userId: string): Promise<void> {
		this.connectedUsers.add(userId);
		const member = this.members.get(userId);
		if (member) {
			if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
			member.disconnectTimer = undefined;
			member.player.connected = true;
			member.player.ready = false;
			this.onChange();
		}
	}

	async disconnect(userId: string): Promise<void> {
		this.connectedUsers.delete(userId);
		const member = this.members.get(userId);
		if (!member) return;

		member.player.connected = false;
		member.player.ready = false;
		this.scheduleDisconnectRemoval(userId);
		this.onChange();
	}

	async join(userId: string, displayName: string): Promise<LobbySnapshot> {
		if (!this.connectedUsers.has(userId)) {
			throw new LobbyError('not-connected', 'Connect to the lobby before joining.');
		}

		const existing = this.members.get(userId);
		if (existing) {
			if (existing.disconnectTimer) clearTimeout(existing.disconnectTimer);
			existing.disconnectTimer = undefined;
			existing.player.connected = true;
			existing.player.ready = false;
			this.onChange();
			return this.snapshot();
		}
		if (this.members.size >= this.capacity()) {
			throw new LobbyError('lobby-full', 'The lobby is full.');
		}
		await this.store?.addMember(userId, displayName);

		this.resetReadiness();
		this.members.set(userId, {
			player: { userId, displayName, team: null, connected: true, ready: false },
		});
		this.onChange();
		return this.snapshot();
	}

	async leave(userId: string): Promise<LobbySnapshot> {
		const hadMember = this.members.has(userId);
		await this.removeMember(userId);
		if (hadMember) this.resetReadiness();
		this.onChange();
		return this.snapshot();
	}

	async setName(userId: string, displayName: string): Promise<LobbySnapshot> {
		const member = this.requireMember(userId);
		await this.store?.setName(userId, displayName);
		member.player.displayName = displayName;
		this.onChange();
		return this.snapshot();
	}

	async joinTeam(userId: string, team: TeamId): Promise<LobbySnapshot> {
		const member = this.requireMember(userId);
		if (member.player.team === team) return this.snapshot();

		const teamCount = [...this.members.values()].filter((entry) => entry.player.team === team).length;
		if (teamCount >= this.teamSize) {
			throw new LobbyError('team-full', `Team ${team === 'a' ? '1' : '2'} is full.`);
		}

		await this.store?.setTeam(userId, team);
		this.resetReadiness();
		member.player.team = team;
		this.onChange();
		return this.snapshot();
	}

	setReady(userId: string, ready: boolean): LobbySnapshot {
		const member = this.requireMember(userId);
		if (!member.player.connected) {
			throw new LobbyError('not-connected', 'Reconnect to the lobby before readying up.');
		}
		if (ready && !this.canReady()) {
			throw new LobbyError('lobby-not-ready', 'Both teams must be full of connected players before readying up.');
		}
		member.player.ready = ready;
		this.onChange();
		return this.snapshot();
	}

	// Changes how many players each team holds (1 to 3). Only the host, the
	// earliest member still in the lobby, may do this. When the size shrinks,
	// random players are moved off any team that is over it, then random
	// players (never the host) leave the lobby until it fits the new capacity.
	async setTeamSize(userId: string, size: unknown): Promise<LobbySnapshot> {
		this.requireMember(userId);
		if (userId !== this.hostId()) {
			throw new LobbyError('not-host', 'Only the host can change the team size.');
		}
		if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_TEAM_SIZE) {
			throw new LobbyError('invalid-team-size', `Choose between 1 and ${MAX_TEAM_SIZE} players per team.`);
		}
		this.teamSize = size;
		for (const team of ['a', 'b'] as TeamId[]) {
			const onTeam = shuffle([...this.members.values()].filter(({ player }) => player.team === team));
			for (const { player } of onTeam.slice(size)) {
				await this.store?.clearTeam(player.userId);
				player.team = null;
			}
		}
		const others = [...this.members.values()].filter(({ player }) => player.userId !== userId);
		// Players without a team go first, so team members are only removed when nothing else fits.
		const removable = [...shuffle(others.filter(({ player }) => player.team === null)), ...shuffle(others.filter(({ player }) => player.team !== null))];
		while (this.members.size > this.capacity()) {
			const next = removable.shift();
			if (!next) break;
			await this.removeMember(next.player.userId);
		}
		this.resetReadiness();
		this.onChange();
		return this.snapshot();
	}

	// Releases the seats of players who have moved on to a match, so the lobby
	// opens for a new group straight away.
	async removePlayers(userIds: string[]): Promise<void> {
		for (const userId of userIds) await this.removeMember(userId);
		this.resetReadiness();
		this.onChange();
	}

	// Clears every member's ready flag, e.g. after a failed match start, so the
	// lobby can count down again from scratch.
	unreadyAll(): void {
		this.resetReadiness();
		this.onChange();
	}

	snapshot(): LobbySnapshot {
		return {
			players: [...this.members.values()].map(({ player }) => ({ ...player })),
			playerCount: this.members.size,
			readyCount: [...this.members.values()].filter(({ player }) => player.ready).length,
			canReady: this.canReady(),
			readyToStart: this.isReadyToStart(),
			teamSize: this.teamSize,
			hostId: this.hostId(),
		};
	}

	stop(): void {
		for (const member of this.members.values()) {
			if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
		}
	}

	// The host is whoever joined earliest among the players still in the lobby
	// (Map keeps insertion order), so it passes on automatically when they leave.
	private hostId(): string | null {
		return this.members.keys().next().value ?? null;
	}

	private capacity(): number {
		return this.teamSize * 2;
	}

	private requireMember(userId: string): MemberRecord {
		const member = this.members.get(userId);
		if (!member) throw new LobbyError('not-in-lobby', 'Join the lobby first.');
		return member;
	}

	private async removeMember(userId: string): Promise<boolean> {
		const member = this.members.get(userId);
		if (!member) return false;
		if (member?.disconnectTimer) clearTimeout(member.disconnectTimer);
		await this.store?.removeMember(userId);
		this.members.delete(userId);
		this.resetReadiness();
		return true;
	}

	private resetReadiness(): void {
		for (const { player } of this.members.values()) player.ready = false;
	}

	private scheduleDisconnectRemoval(userId: string): void {
		const member = this.members.get(userId);
		if (!member) return;
		if (member.disconnectTimer) clearTimeout(member.disconnectTimer);
		member.disconnectTimer = setTimeout(() => {
			void this.removeMember(userId).then((removed) => {
				if (removed) this.onChange();
			}).catch((error: unknown) => {
				console.error('[lobby-service] could not release disconnected lobby seat', error);
			});
		}, this.disconnectGraceMs);
		member.disconnectTimer.unref?.();
	}

	private canReady(): boolean {
		const members = [...this.members.values()];
		const teamACount = members.filter((entry) => entry.player.team === 'a').length;
		const teamBCount = members.filter((entry) => entry.player.team === 'b').length;
		return members.length === this.capacity()
			&& teamACount === this.teamSize
			&& teamBCount === this.teamSize
			&& members.every(({ player }) => player.connected);
	}

	private isReadyToStart(): boolean {
		const members = [...this.members.values()];
		return this.canReady() && members.every(({ player }) => player.ready);
	}
}

// Fisher-Yates: returns a copy of `items` in random order.
function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
