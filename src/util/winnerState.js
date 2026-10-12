import { access, copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { resolveDataFile } from './dataDir.js';

const WINNER_STATE_FILE = 'winner-state.json';

/**
 * @typedef {{ winnersOpen: Record<string, number>; winnersNB: Record<string, number> }} WinnerState
 */

const emptyState = () => ({ winnersOpen: {}, winnersNB: {} });

function normalizeImportedCategory(value, category) {
	if (!Array.isArray(value)) {
		throw new Error(`The "${category}" field must be an array.`);
	}

	const output = {};
	for (const entry of value) {
		if (!entry || typeof entry !== 'object') {
			throw new Error(`Each "${category}" entry must be an object.`);
		}
		const player = entry.player;
		const wins = entry.wins;
		if (typeof player !== 'string' || !/^\d{17,20}$/.test(player)) {
			throw new Error(`Each "${category}" player must be a Discord user ID.`);
		}
		if (!Number.isSafeInteger(wins) || wins < 0) {
			throw new Error(`Wins for ${player} must be a non-negative integer.`);
		}
		if (player in output) {
			throw new Error(`Duplicate player ID in "${category}": ${player}.`);
		}
		output[player] = wins;
	}
	return output;
}

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
 * Replaces all winner totals after validating an import payload.
 *
 * @param {unknown} payload
 * @returns {Promise<{ openCount: number; nbCount: number; backupPath: string | null }>}
 */
export async function importWinnerState(payload) {
	if (!payload || typeof payload !== 'object') {
		throw new Error('The JSON root must be an object.');
	}

	const source = /** @type {Record<string, unknown>} */ (payload);
	const state = {
		winnersOpen: normalizeImportedCategory(source.open, 'open'),
		winnersNB: normalizeImportedCategory(source.nb, 'nb'),
	};

	const path = await resolveDataFile(WINNER_STATE_FILE);
	let backupPath = null;
	try {
		await access(path);
		backupPath = `${path}.backup-${Date.now()}.json`;
		await copyFile(path, backupPath);
	} catch {
		// There is no existing state to back up.
	}

	const temporaryPath = `${path}.tmp-${Date.now()}`;
	try {
		await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
		await rename(temporaryPath, path);
	} catch (error) {
		try {
			await access(temporaryPath);
			await rename(temporaryPath, path);
		} catch {
			// Leave the original state untouched if the temporary file was not created.
		}
		throw error;
	}

	return {
		openCount: Object.keys(state.winnersOpen).length,
		nbCount: Object.keys(state.winnersNB).length,
		backupPath,
	};
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
