import { closeMatchAsDraw, fetchNormalizedMatches, reopenMatch } from './challonge.js';
import { getHeatSlug, listHeats } from './heatConfig.js';

const ACTIVE_STATES = new Set(['open', 'pending']);

/**
 * Closes all open/pending matches in the current round and reopens completed matches from the previous round.
 *
 * @param {number} heatNumber
 * @returns {Promise<{
 *   heatNumber: number;
 *   slug: string;
 *   currentRound: number;
 *   previousRound: number;
 *   closedCount: number;
 *   reopenedCount: number;
 *   closedLabels: string[];
 *   reopenedLabels: string[];
 * }>}
 */
export async function resetHeatRound(heatNumber) {
	const slug = await getHeatSlug(heatNumber);
	const matches = await fetchNormalizedMatches(slug);

	const activeMatches = matches.filter((m) => ACTIVE_STATES.has(m.state));
	if (activeMatches.length === 0) {
		throw new Error(`Heat ${heatNumber}: no open or pending matches — nothing to treat as the current round.`);
	}

	const currentRound = Math.max(...activeMatches.map((m) => m.round));
	const previousRound = currentRound - 1;
	if (previousRound < 1) {
		throw new Error(`Heat ${heatNumber}: current round is 1 — there is no previous round to reopen.`);
	}

	const toClose = matches.filter((m) => m.round === currentRound && ACTIVE_STATES.has(m.state));
	const toReopen = matches.filter((m) => m.round === previousRound && m.state === 'complete');

	if (toReopen.length === 0) {
		throw new Error(`Heat ${heatNumber}: no completed matches found in round ${previousRound} to reopen.`);
	}

	/** @type {string[]} */
	const closedLabels = [];
	for (const match of toClose) {
		try {
			await closeMatchAsDraw(slug, match.id);
			closedLabels.push(match.label);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Heat ${heatNumber}: failed to close "${match.label}": ${message}`);
		}
	}

	/** @type {string[]} */
	const reopenedLabels = [];
	const reopenOrder = [...toReopen].sort((a, b) => b.id - a.id);
	for (const match of reopenOrder) {
		try {
			await reopenMatch(slug, match.id);
			reopenedLabels.push(match.label);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Heat ${heatNumber}: failed to reopen "${match.label}": ${message}`);
		}
	}

	return {
		heatNumber,
		slug,
		currentRound,
		previousRound,
		closedCount: closedLabels.length,
		reopenedCount: reopenedLabels.length,
		closedLabels,
		reopenedLabels,
	};
}

/**
 * @typedef {Awaited<ReturnType<typeof resetHeatRound>>} ResetHeatResult
 */

/**
 * Resets the current round for every configured heat.
 *
 * @returns {Promise<{ results: ResetHeatResult[]; failures: Array<{ heatNumber: number; error: string }> }>}
 */
export async function resetAllHeats() {
	const heats = await listHeats();
	if (heats.length === 0) {
		throw new Error('No heats are configured in tracking.txt.');
	}

	/** @type {ResetHeatResult[]} */
	const results = [];
	/** @type {Array<{ heatNumber: number; error: string }>} */
	const failures = [];

	for (const { number: heatNumber } of heats) {
		try {
			results.push(await resetHeatRound(heatNumber));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push({ heatNumber, error: message });
		}
	}

	if (results.length === 0) {
		throw new Error(failures.map(({ heatNumber, error }) => `Heat ${heatNumber}: ${error}`).join('\n'));
	}

	return { results, failures };
}
