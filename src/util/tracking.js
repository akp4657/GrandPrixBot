import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TRACKING_FILE = 'tracking.txt';
const PREFIX_OPEN = 'WinnersOpen: ';
const PREFIX_NB = 'WinnersNB: ';
const PREFIX_DUE = 'DueDate: ';

/**
 * Winner counts are keyed by Discord user id (snowflake string). Legacy username keys
 * in existing files are ignored for new increments; migrate manually if needed.
 *
 * @param {string} content
 * @returns {{ otherLines: string[]; dueDate: string; winnersOpen: Record<string, number>; winnersNB: Record<string, number> }}
 */
function parseTracking(content) {
	/** @type {string[]} */
	const otherLines = [];
	/** @type {Record<string, number>} */
	let winnersOpen = {};
	/** @type {Record<string, number>} */
	let winnersNB = {};
	let dueDate = '';

	for (const line of content.split(/\r?\n/)) {
		if (!line.trim()) continue;
		if (line.startsWith(PREFIX_OPEN)) {
			try {
				winnersOpen = /** @type {Record<string, number>} */ (JSON.parse(line.slice(PREFIX_OPEN.length) || '{}'));
			} catch {
				winnersOpen = {};
			}
		} else if (line.startsWith(PREFIX_NB)) {
			try {
				winnersNB = /** @type {Record<string, number>} */ (JSON.parse(line.slice(PREFIX_NB.length) || '{}'));
			} catch {
				winnersNB = {};
			}
		} else if (line.startsWith(PREFIX_DUE)) {
			dueDate = line.slice(PREFIX_DUE.length).trim();
		} else {
			otherLines.push(line);
		}
	}

	return { otherLines, dueDate, winnersOpen, winnersNB };
}

/**
 * @param {{ otherLines: string[]; dueDate: string; winnersOpen: Record<string, number>; winnersNB: Record<string, number> }} data
 */
function serializeTracking(data) {
	const lines = [
		...data.otherLines,
		`${PREFIX_DUE}${data.dueDate}`,
		`${PREFIX_OPEN}${JSON.stringify(data.winnersOpen)}`,
		`${PREFIX_NB}${JSON.stringify(data.winnersNB)}`,
	];
	return `${lines.join('\n')}\n`;
}

/** @returns {Promise<string>} raw path to tracking.txt */
function trackingPath() {
	return Promise.resolve(join(process.cwd(), TRACKING_FILE));
}

/**
 * Returns the current DueDate as a Date object, or null if unset / unparseable.
 *
 * @returns {Promise<Date | null>}
 */
export async function readDueDate() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	const { dueDate } = parseTracking(raw);
	if (!dueDate) return null;
	const d = new Date(dueDate);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** @returns {Promise<string>} Raw DueDate line value (may be empty). */
export async function readDueDateRaw() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	return parseTracking(raw).dueDate;
}

/**
 * Updates the DueDate line in tracking.txt. Pass an empty string to clear it.
 *
 * @param {string} dateStr e.g. '2026-05-01 18:00' or ''
 */
export async function writeDueDate(dateStr) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	await writeFile(path, serializeTracking({ ...data, dueDate: dateStr }), 'utf-8');
}

/**
 * @param {'open' | 'nb'} category
 * @param {string} userId Discord user snowflake
 * @returns {Promise<number>} new total wins for that user in that category
 */
export async function incrementWinner(category, userId) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	const target = category === 'open' ? 'winnersOpen' : 'winnersNB';
	const obj = { ...data[target] };
	const key = String(userId);
	obj[key] = (obj[key] ?? 0) + 1;
	await writeFile(path, serializeTracking({ ...data, [target]: obj }), 'utf-8');
	return obj[key];
}
