import { readFile, writeFile } from 'node:fs/promises';
import { resolveDataFile } from './dataDir.js';
import { formatHeatLines, isHeatConfigLine } from './heatConfig.js';

const TRACKING_FILE = 'tracking.txt';
const PREFIX_OPEN = 'WinnersOpen: ';
const PREFIX_NB = 'WinnersNB: ';
const PREFIX_DUE = 'DueDate: ';
const PREFIX_DUE_CLOSED = 'DueDateMatchesClosed: ';
const PREFIX_DUE_CLOSED_COUNT = 'DueDateClosedCount: ';
const PREFIX_DUE_NOTIFIED = 'DueDateNotified: ';

/** Due dates in tracking.txt use 24-hour clock: `YYYY-MM-DD HH:MM` (US Eastern). */
export const DUE_DATE_TZ = 'America/New_York';
export const DUE_DATE_FORMAT = 'YYYY-MM-DD HH:MM';
const DUE_DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;
const DUE_DATE_CANONICAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;

/**
 * @param {number} utcMs
 */
function easternPartsAt(utcMs) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: DUE_DATE_TZ,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(new Date(utcMs));
	return {
		year: Number(parts.find((p) => p.type === 'year')?.value),
		month: Number(parts.find((p) => p.type === 'month')?.value),
		day: Number(parts.find((p) => p.type === 'day')?.value),
		hour: Number(parts.find((p) => p.type === 'hour')?.value),
		minute: Number(parts.find((p) => p.type === 'minute')?.value),
	};
}

/**
 * Validates and normalizes a due date string to `YYYY-MM-DD HH:MM` (24-hour, zero-padded).
 *
 * @param {string} dateStr
 * @returns {string | null}
 */
export function normalizeDueDateString(dateStr) {
	const m = dateStr.trim().match(DUE_DATE_INPUT_PATTERN);
	if (!m) {
		return null;
	}

	const month = Number(m[2]);
	const day = Number(m[3]);
	const hour = Number(m[4]);
	const minute = Number(m[5]);

	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return null;
	}
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		return null;
	}

	return `${m[1]}-${m[2]}-${m[3]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse `YYYY-MM-DD HH:MM` (24-hour) as US Eastern (America/New_York).
 *
 * @param {string} dateStr
 * @returns {Date | null}
 */
export function parseDueDateEst(dateStr) {
	const normalized = normalizeDueDateString(dateStr);
	if (!normalized) {
		return null;
	}

	const m = normalized.match(DUE_DATE_CANONICAL_PATTERN);
	if (!m) {
		return null;
	}

	const target = {
		year: Number(m[1]),
		month: Number(m[2]),
		day: Number(m[3]),
		hour: Number(m[4]),
		minute: Number(m[5]),
	};

	const matchesTarget = (utcMs) => {
		const p = easternPartsAt(utcMs);
		return (
			p.year === target.year &&
			p.month === target.month &&
			p.day === target.day &&
			p.hour === target.hour &&
			p.minute === target.minute
		);
	};

	for (const offsetHours of [4, 5]) {
		const candidate = Date.UTC(target.year, target.month - 1, target.day, target.hour + offsetHours, target.minute);
		if (matchesTarget(candidate)) {
			return new Date(candidate);
		}
	}

	const guess = Date.UTC(target.year, target.month - 1, target.day, 17, 0);
	for (let delta = -24 * 60; delta <= 24 * 60; delta++) {
		const candidate = guess + delta * 60_000;
		if (matchesTarget(candidate)) {
			return new Date(candidate);
		}
	}

	return null;
}

/**
 * @param {string} content
 * @returns {{
 *   otherLines: string[];
 *   dueDate: string;
 *   dueDateMatchesClosed: string;
 *   dueDateClosedCount: number;
 *   dueDateNotified: string;
 *   winnersOpen: Record<string, number>;
 *   winnersNB: Record<string, number>;
 * }}
 */
function parseTracking(content) {
	/** @type {string[]} */
	const otherLines = [];
	/** @type {Record<string, number>} */
	let winnersOpen = {};
	/** @type {Record<string, number>} */
	let winnersNB = {};
	let dueDate = '';
	let dueDateMatchesClosed = '';
	let dueDateClosedCount = 0;
	let dueDateNotified = '';

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
		} else if (line.startsWith(PREFIX_DUE_NOTIFIED)) {
			dueDateNotified = line.slice(PREFIX_DUE_NOTIFIED.length).trim();
		} else if (line.startsWith(PREFIX_DUE_CLOSED_COUNT)) {
			const n = Number(line.slice(PREFIX_DUE_CLOSED_COUNT.length).trim());
			dueDateClosedCount = Number.isFinite(n) ? n : 0;
		} else if (line.startsWith(PREFIX_DUE_CLOSED)) {
			dueDateMatchesClosed = line.slice(PREFIX_DUE_CLOSED.length).trim();
		} else if (line.startsWith(PREFIX_DUE)) {
			dueDate = line.slice(PREFIX_DUE.length).trim();
		} else {
			otherLines.push(line);
		}
	}

	return { otherLines, dueDate, dueDateMatchesClosed, dueDateClosedCount, dueDateNotified, winnersOpen, winnersNB };
}

/**
 * @param {{
 *   otherLines: string[];
 *   dueDate: string;
 *   dueDateMatchesClosed: string;
 *   dueDateClosedCount: number;
 *   dueDateNotified: string;
 *   winnersOpen: Record<string, number>;
 *   winnersNB: Record<string, number>;
 * }} data
 */
function serializeTracking(data) {
	const lines = [
		...data.otherLines,
		`${PREFIX_DUE}${data.dueDate}`,
		`${PREFIX_DUE_CLOSED}${data.dueDateMatchesClosed}`,
		`${PREFIX_DUE_CLOSED_COUNT}${data.dueDateClosedCount}`,
		`${PREFIX_DUE_NOTIFIED}${data.dueDateNotified}`,
		`${PREFIX_OPEN}${JSON.stringify(data.winnersOpen)}`,
		`${PREFIX_NB}${JSON.stringify(data.winnersNB)}`,
	];
	return `${lines.join('\n')}\n`;
}

/** @returns {Promise<string>} raw path to tracking.txt */
function trackingPath() {
	return resolveDataFile(TRACKING_FILE);
}

/**
 * Returns the current DueDate as a Date (US Eastern), or null if unset / unparseable.
 *
 * @returns {Promise<Date | null>}
 */
export async function readDueDate() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	const { dueDate } = parseTracking(raw);
	if (!dueDate) return null;
	return parseDueDateEst(dueDate);
}

/** @returns {Promise<string>} Raw DueDate line value (may be empty). */
export async function readDueDateRaw() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	return parseTracking(raw).dueDate;
}

/** @returns {Promise<string>} Raw DueDateMatchesClosed value (may be empty). */
export async function readDueDateMatchesClosedRaw() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	return parseTracking(raw).dueDateMatchesClosed;
}

/** @returns {Promise<number>} Matches auto-closed when the current deadline was processed. */
export async function readDueDateClosedCount() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	return parseTracking(raw).dueDateClosedCount;
}

/** @returns {Promise<string>} Raw DueDateNotified value (may be empty). */
export async function readDueDateNotifiedRaw() {
	const raw = await readFile(await trackingPath(), 'utf-8');
	return parseTracking(raw).dueDateNotified;
}

/**
 * Updates the DueDate line in tracking.txt. Pass an empty string to clear it.
 * Also clears deadline-processing state when the due date is cleared or changed.
 *
 * @param {string} dateStr e.g. '2026-05-01 18:00' (US Eastern) or ''
 */
export async function writeDueDate(dateStr) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	const stored = dateStr === '' ? '' : (normalizeDueDateString(dateStr) ?? dateStr.trim());
	await writeFile(
		path,
		serializeTracking({
			...data,
			dueDate: stored,
			dueDateMatchesClosed: '',
			dueDateClosedCount: 0,
			dueDateNotified: '',
		}),
		'utf-8',
	);
}

/**
 * @param {string} dueDateRaw
 */
export async function writeDueDateNotified(dueDateRaw) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	await writeFile(path, serializeTracking({ ...data, dueDateNotified: dueDateRaw }), 'utf-8');
}

/**
 * @param {{ heats: Map<number, string>; dueDate: string }} config
 */
export async function writeHeatConfiguration({ heats, dueDate }) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	const otherLines = data.otherLines.filter((line) => !isHeatConfigLine(line));
	const dueDateChanged = dueDate !== data.dueDate;

	await writeFile(
		path,
		serializeTracking({
			...data,
			otherLines: [...formatHeatLines(heats), ...otherLines],
			dueDate,
			dueDateMatchesClosed: dueDateChanged ? '' : data.dueDateMatchesClosed,
			dueDateClosedCount: dueDateChanged ? 0 : data.dueDateClosedCount,
			dueDateNotified: dueDateChanged ? '' : data.dueDateNotified,
		}),
		'utf-8',
	);
}

/**
 * Records that open matches were auto-closed for the given due date string.
 *
 * @param {string} dueDateRaw
 * @param {number} closedCount
 */
export async function writeDueDateMatchesClosed(dueDateRaw, closedCount) {
	const path = await trackingPath();
	const raw = await readFile(path, 'utf-8');
	const data = parseTracking(raw);
	await writeFile(
		path,
		serializeTracking({
			...data,
			dueDateMatchesClosed: dueDateRaw,
			dueDateClosedCount: closedCount,
		}),
		'utf-8',
	);
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
