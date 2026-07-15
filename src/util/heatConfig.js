import { readFile } from 'node:fs/promises';
import { resolveDataFile } from './dataDir.js';

const TRACKING_FILE = 'tracking.txt';
const HEAT_LINE_RE = /^Heat (\d+):\s*(.*)$/i;

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isHeatConfigLine(line) {
	return HEAT_LINE_RE.test(line.trim());
}

/**
 * Parse `Heat N: slug` lines from text (full file or modal input).
 *
 * @param {string} content
 * @returns {Map<number, string>}
 */
export function parseHeatLines(content) {
	/** @type {Map<number, string>} */
	const heats = new Map();

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(HEAT_LINE_RE);
		if (!match) continue;

		const heatNumber = Number(match[1]);
		if (!Number.isFinite(heatNumber) || heatNumber < 1) continue;

		heats.set(heatNumber, (match[2] ?? '').trim());
	}

	return heats;
}

/**
 * @param {Map<number, string>} heats
 * @returns {string[]}
 */
export function formatHeatLines(heats) {
	return [...heats.entries()]
		.sort(([a], [b]) => a - b)
		.map(([number, slug]) => `Heat ${number}: ${slug}`);
}

/**
 * @returns {Promise<Map<number, string>>}
 */
export async function readHeatConfig() {
	const filePath = await resolveDataFile(TRACKING_FILE);
	const content = await readFile(filePath, 'utf-8');
	return parseHeatLines(content);
}

/**
 * @returns {Promise<Array<{ number: number; slug: string }>>}
 */
export async function listHeats() {
	const heats = await readHeatConfig();
	return [...heats.entries()]
		.sort(([a], [b]) => a - b)
		.map(([number, slug]) => ({ number, slug }));
}

/**
 * @param {number} heatNumber
 * @returns {Promise<string>}
 */
export async function getHeatSlug(heatNumber) {
	const heats = await readHeatConfig();
	const slug = heats.get(heatNumber);
	if (!slug) {
		throw new Error(`Heat ${heatNumber} is not configured.`);
	}
	return slug;
}

/**
 * @returns {Promise<string[]>}
 */
export async function getConfiguredHeatSlugs() {
	const heats = await listHeats();
	return heats.map(({ slug }) => slug).filter(Boolean);
}
