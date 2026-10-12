import { readFile, writeFile } from 'node:fs/promises';
import { resolveDataFile } from './dataDir.js';

const WINNER_STATE_FILE = 'winner-state.json';

/**
 * @typedef {{ winnersOpen: Record<string, number>; winnersNB: Record<string, number> }} WinnerState
 */

const emptyState = () => ({ winnersOpen: {}, winnersNB: {} });

async function readState() {
	try {
		const raw = JSON.parse(await readFile(await resolveDataFile(WINNER_STATE_FILE), 'utf8'));
		return {
			winnersOpen: raw?.winnersOpen && typeof raw.winnersOpen === 'object' ? raw.winnersOpen : {},
			winnersNB: raw?.winnersNB && typeof raw.winnersNB === 'object' ? raw.winnersNB : {},
		};
	} catch {
		return emptyState();
	}
}

/** @returns {Promise<WinnerState>} */
export async function readWinnerState() {
	return readState();
}

/**
 * @param {'open' | 'nb'} category
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function incrementWinner(category, userId) {
	const state = await readState();
	const target = category === 'open' ? 'winnersOpen' : 'winnersNB';
	const total = (state[target][userId] ?? 0) + 1;
	state[target][userId] = total;
	await writeFile(await resolveDataFile(WINNER_STATE_FILE), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
	return total;
}
