import process from 'node:process';

const BASE = 'https://api.challonge.com/v1';

/** Reportable matches: not yet finalized in Challonge. */
const REPORTABLE_STATES = new Set(['open', 'pending']);

/**
 * @returns {HeadersInit}
 */
function authHeaders() {
	const username = process.env.CHALLONGE_USERNAME;
	const apiKey = process.env.CHALLONGE_API_KEY;
	if (!username || !apiKey) {
		throw new Error('Missing CHALLONGE_USERNAME or CHALLONGE_API_KEY in environment.');
	}
	const token = Buffer.from(`${username}:${apiKey}`).toString('base64');
	return { Authorization: `Basic ${token}` };
}

/**
 * @param {Response} res
 * @returns {Promise<never>}
 */
async function throwForBadResponse(res) {
	const text = await res.text();
	throw new Error(`Challonge API error ${res.status}: ${text.slice(0, 500)}`);
}

/**
 * @param {Record<string, unknown>} wrapped
 * @param {'player1' | 'player2'} side
 * @param {Map<number, string>} participantMap
 * @returns {string}
 */
function resolveSideName(wrapped, side, participantMap) {
	const obj = wrapped[side];
	const pObj = obj && typeof obj === 'object' ? /** @type {Record<string, unknown>} */ (obj) : null;
	const fromObj = pObj && 'name' in pObj && pObj.name != null ? String(pObj.name) : '';
	const flatKey = `${side}_name`;
	const fromFlat = typeof wrapped[flatKey] === 'string' ? /** @type {string} */ (wrapped[flatKey]) : '';
	const combined = (fromObj || fromFlat).trim();
	if (combined) {
		return combined;
	}

	const idKey = `${side}_id`;
	const rawId = wrapped[idKey];
	if (rawId === null || rawId === undefined) {
		return 'Bye';
	}
	const id = typeof rawId === 'number' ? rawId : Number(rawId);
	if (!Number.isFinite(id)) {
		return 'Bye';
	}
	return participantMap.get(id)?.trim() || 'TBD';
}

/**
 * @param {Record<string, unknown>} wrapped
 * @param {'player1' | 'player2'} side
 * @returns {number | null}
 */
function participantSlotId(wrapped, side) {
	const idKey = `${side}_id`;
	const rawId = wrapped[idKey];
	if (rawId === null || rawId === undefined) {
		return null;
	}
	const id = typeof rawId === 'number' ? rawId : Number(rawId);
	return Number.isFinite(id) ? id : null;
}

/**
 * @param {unknown} item
 * @param {Map<number, string>} participantMap
 * @returns {{ id: number; state: string; label: string; raw: Record<string, unknown> }}
 */
function normalizeMatch(item, participantMap) {
	const wrapped =
		item && typeof item === 'object' && 'match' in item
			? /** @type {{ match: Record<string, unknown> }} */ (item).match
			: /** @type {Record<string, unknown>} */ (item);

	const rawId = wrapped?.id;
	const id = typeof rawId === 'number' ? rawId : Number(rawId);
	const state = typeof wrapped?.state === 'string' ? wrapped.state : '';
	if (!Number.isFinite(id)) {
		throw new Error('Invalid match payload from Challonge.');
	}

	const a = resolveSideName(wrapped, 'player1', participantMap);
	const b = resolveSideName(wrapped, 'player2', participantMap);
	const label = `${a} vs ${b}`;
	return {
		id,
		state,
		label,
		raw: wrapped,
	};
}

/**
 * @param {string} tournamentSlug
 * @returns {Promise<Map<number, string>>}
 */
export async function fetchParticipantsMap(tournamentSlug) {
	const url = `${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/participants.json`;
	const res = await fetch(url, { headers: { ...authHeaders() } });
	if (!res.ok) {
		await throwForBadResponse(res);
	}

	/** @type {unknown} */
	const data = await res.json();
	if (!Array.isArray(data)) {
		throw new Error('Unexpected Challonge participants response.');
	}

	/** @type {Map<number, string>} */
	const map = new Map();
	for (const item of data) {
		const p =
			item && typeof item === 'object' && 'participant' in item
				? /** @type {{ participant: Record<string, unknown> }} */ (item).participant
				: /** @type {Record<string, unknown>} */ (item);
		const rawPid = p?.id;
		const pid = typeof rawPid === 'number' ? rawPid : Number(rawPid);
		if (!Number.isFinite(pid)) {
			continue;
		}
		const name =
			(typeof p.name === 'string' && p.name.trim()) ||
			(typeof p.username === 'string' && p.username.trim()) ||
			`Player ${pid}`;
		map.set(pid, name);
	}
	return map;
}

/**
 * Lists matches for a tournament and returns reportable ones (open / pending).
 *
 * @param {string} tournamentSlug
 * @returns {Promise<Array<{ id: number; state: string; label: string }>>}
 */
export async function listReportableMatches(tournamentSlug) {
	const matchesUrl = new URL(`${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/matches.json`);
	matchesUrl.searchParams.set('include_participants', '1');

	const [participantMap, res] = await Promise.all([
		fetchParticipantsMap(tournamentSlug),
		fetch(matchesUrl, { headers: { ...authHeaders() } }),
	]);

	//console.log(res);
	//console.log(participantMap);
	if (!res.ok) {
		await throwForBadResponse(res);
	}

	/** @type {unknown} */
	const data = await res.json();
	if (!Array.isArray(data)) {
		throw new Error('Unexpected Challonge matches response.');
	}

	/** @type {Array<{ id: number; state: string; label: string }>} */
	const out = [];
	for (const item of data) {
		//console.log(item);
		const norm = normalizeMatch(item, participantMap);
		console.log(norm);
		if (REPORTABLE_STATES.has(norm.state) || norm.raw.winner_id === null) {
			out.push({ id: norm.id, state: norm.state, label: norm.label });
		}
	}
	return out;
}

/**
 * Display names for modal labels (Challonge player1 / player2 order).
 *
 * @param {string} tournamentSlug
 * @param {number} matchId
 * @returns {Promise<{ player1: string; player2: string; player1Id: number | null; player2Id: number | null; label: string }>}
 */
export async function getMatchDisplayNames(tournamentSlug, matchId) {
	const [participantMap, res] = await Promise.all([
		fetchParticipantsMap(tournamentSlug),
		fetch(`${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/matches/${matchId}.json`, {
			headers: { ...authHeaders() },
		}),
	]);

	if (!res.ok) {
		await throwForBadResponse(res);
	}

	/** @type {unknown} */
	const data = await res.json();
	const wrapped =
		data && typeof data === 'object' && 'match' in data
			? /** @type {{ match: Record<string, unknown> }} */ (data).match
			: /** @type {Record<string, unknown>} */ (data);

	const player1 = resolveSideName(wrapped, 'player1', participantMap);
	const player2 = resolveSideName(wrapped, 'player2', participantMap);
	return {
		player1,
		player2,
		player1Id: participantSlotId(wrapped, 'player1'),
		player2Id: participantSlotId(wrapped, 'player2'),
		label: `${player1} vs ${player2}`,
	};
}

/**
 * @param {string} tournamentSlug
 * @param {number} matchId
 * @param {string} score
 * @param {number | 'tie'} winnerId Challonge participant id, or `'tie'`.
 * @returns {Promise<void>}
 */
export async function updateMatchScores(tournamentSlug, matchId, score, winnerId) {
	const url = `${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/matches/${matchId}.json`;
	const body = new URLSearchParams();
	body.set('match[scores_csv]', score);
	if (winnerId === null) {
		body.set('match[winner_id]', null);
	} else {
		body.set('match[winner_id]', String(winnerId));
	}

	const res = await fetch(url, {
		method: 'PUT',
		headers: {
			...authHeaders(),
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: body.toString(),
	});
	if (!res.ok) {
		await throwForBadResponse(res);
	}
}

/**
 * @param {string} slug
 * @returns {string}
 */
export function challongeTournamentUrl(slug) {
	return `https://challonge.com/${slug}`;
}
