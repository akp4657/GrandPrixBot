import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TRACKING_FILE = 'tracking.txt';
const PREFIX_OPEN = 'WinnersOpen: ';
const PREFIX_NB = 'WinnersNB: ';

/**
 * Keys are Discord usernames (can change over time; ids would be more stable).
 *
 * @param {string} content
 * @returns {{ otherLines: string[]; winnersOpen: Record<string, number>; winnersNB: Record<string, number> }}
 */
function parseTracking(content) {
	/** @type {string[]} */
	const otherLines = [];
	/** @type {Record<string, number>} */
	let winnersOpen = {};
	/** @type {Record<string, number>} */
	let winnersNB = {};

	for (const line of content.split(/\r?\n/)) {
		if (!line.trim()) {
			continue;
		}
		if (line.startsWith(PREFIX_OPEN)) {
			try {
				winnersOpen = /** @type {Record<string, number>} */ (JSON.parse(line.slice(PREFIX_OPEN.length) || '{}'));
			} catch {
				winnersOpen = {};
			}
			continue;
		}
		if (line.startsWith(PREFIX_NB)) {
			try {
				winnersNB = /** @type {Record<string, number>} */ (JSON.parse(line.slice(PREFIX_NB.length) || '{}'));
			} catch {
				winnersNB = {};
			}
			continue;
		}
		otherLines.push(line);
	}

	return { otherLines, winnersOpen, winnersNB };
}

/**
 * @param {{ otherLines: string[]; winnersOpen: Record<string, number>; winnersNB: Record<string, number> }} data
 */
function serializeTracking(data) {
	const lines = [
		...data.otherLines,
		`${PREFIX_OPEN}${JSON.stringify(data.winnersOpen)}`,
		`${PREFIX_NB}${JSON.stringify(data.winnersNB)}`,
	];
	return `${lines.join('\n')}\n`;
}

/**
 * @param {'open' | 'nb'} category
 * @param {string} username
 * @returns {Promise<number>} new total wins for that user in that category
 */
export async function incrementWinner(category, username) {
	const path = join(process.cwd(), TRACKING_FILE);
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	const target = category === 'open' ? 'winnersOpen' : 'winnersNB';
	const obj = { ...data[target] };
	const nextCount = (obj[username] ?? 0) + 1;
	obj[username] = nextCount;
	const out = { ...data, [target]: obj };
	await writeFile(path, serializeTracking(out), 'utf-8');
	return nextCount;
}
