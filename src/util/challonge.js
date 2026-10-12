import process from 'node:process';

const BASE = 'https://api.challonge.com/v1';
const OPEN_STATES = new Set(['open', 'pending']);

function authHeaders() {
	const username = process.env.CHALLONGE_USERNAME;
	const apiKey = process.env.CHALLONGE_API_KEY;
	if (!username || !apiKey) {
		throw new Error('Missing CHALLONGE_USERNAME or CHALLONGE_API_KEY in environment.');
	}
	return {
		Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
	};
}

async function throwForBadResponse(response) {
	const text = await response.text();
	throw new Error(`Challonge API error ${response.status}: ${text.slice(0, 500)}`);
}

function wrappedMatch(item) {
	return item && typeof item === 'object' && 'match' in item
		? /** @type {{ match: Record<string, unknown> }} */ (item).match
		: /** @type {Record<string, unknown>} */ (item);
}

function participantId(match, side) {
	const value = match[`${side}_id`];
	if (value === null || value === undefined) return null;
	const id = Number(value);
	return Number.isFinite(id) ? id : null;
}

function participantName(match, side, participants) {
	const nested = match[side];
	if (nested && typeof nested === 'object' && 'name' in nested && nested.name) {
		return String(nested.name).trim();
	}
	const flatName = match[`${side}_name`];
	if (typeof flatName === 'string' && flatName.trim()) return flatName.trim();
	return participants.get(participantId(match, side)) ?? 'TBD';
}

async function fetchParticipants(tournamentSlug) {
	const response = await fetch(`${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/participants.json`, {
		headers: authHeaders(),
	});
	if (!response.ok) await throwForBadResponse(response);
	const data = await response.json();
	if (!Array.isArray(data)) throw new Error('Unexpected Challonge participants response.');

	const participants = new Map();
	for (const item of data) {
		const participant = item && typeof item === 'object' && 'participant' in item ? item.participant : item;
		const id = Number(participant?.id);
		const name = participant?.name || participant?.username;
		if (Number.isFinite(id) && typeof name === 'string' && name.trim()) {
			participants.set(id, name.trim());
		}
	}
	return participants;
}

/**
 * @param {string} tournamentSlug
 * @returns {Promise<Array<{ id: number; state: string; label: string; player1: string; player2: string; player1Id: number | null; player2Id: number | null }>>}
 */
export async function listReportableMatches(tournamentSlug) {
	const [participants, response] = await Promise.all([
		fetchParticipants(tournamentSlug),
		fetch(`${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/matches.json?include_participants=1`, {
			headers: authHeaders(),
		}),
	]);
	if (!response.ok) await throwForBadResponse(response);
	const data = await response.json();
	if (!Array.isArray(data)) throw new Error('Unexpected Challonge matches response.');

	const matches = [];
	for (const item of data) {
		const match = wrappedMatch(item);
		const id = Number(match.id);
		const state = typeof match.state === 'string' ? match.state : '';
		if (!Number.isFinite(id) || !OPEN_STATES.has(state)) continue;

		const player1 = participantName(match, 'player1', participants);
		const player2 = participantName(match, 'player2', participants);
		matches.push({
			id,
			state,
			label: `${player1} vs ${player2}`,
			player1,
			player2,
			player1Id: participantId(match, 'player1'),
			player2Id: participantId(match, 'player2'),
		});
	}
	return matches;
}

/**
 * @param {string} tournamentSlug
 * @param {number} matchId
 * @param {string} score
 * @param {number} winnerId
 * @returns {Promise<void>}
 */
export async function updateMatchScores(tournamentSlug, matchId, score, winnerId) {
	const body = new URLSearchParams({
		'match[scores_csv]': score,
		'match[winner_id]': String(winnerId),
	});
	const response = await fetch(`${BASE}/tournaments/${encodeURIComponent(tournamentSlug)}/matches/${matchId}.json`, {
		method: 'PUT',
		headers: { ...authHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});
	if (!response.ok) await throwForBadResponse(response);
}
