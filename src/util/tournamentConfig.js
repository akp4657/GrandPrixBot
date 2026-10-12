import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { resolveDataFile } from './dataDir.js';

const CONFIG_FILE = 'config.json';
const MIN_TOURNAMENTS = 2;

/**
 * @typedef {{ challongeSlugs: string[] }} TournamentConfig
 */

function normalizeSlugs(slugs) {
	return [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function parseSlugs(value) {
	if (!Array.isArray(value)) return [];
	return normalizeSlugs(value.filter((slug) => typeof slug === 'string'));
}

/**
 * @returns {Promise<TournamentConfig>}
 */
export async function readTournamentConfig() {
	const path = await resolveDataFile(CONFIG_FILE);
	try {
		const raw = JSON.parse(await readFile(path, 'utf8'));
		const slugs = parseSlugs(raw?.challongeSlugs);
		if (slugs.length >= MIN_TOURNAMENTS) return { challongeSlugs: slugs };
	} catch {
		// Fall back to the environment for first-time setup.
	}

	const slugs = normalizeSlugs((process.env.CHALLONGE_SLUGS ?? '').split(','));
	if (slugs.length < MIN_TOURNAMENTS) {
		throw new Error(`Configure at least ${MIN_TOURNAMENTS} Challonge slugs.`);
	}
	const config = { challongeSlugs: slugs };
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
	return config;
}

/**
 * @param {string[]} slugs
 * @returns {Promise<TournamentConfig>}
 */
export async function writeTournamentConfig(slugs) {
	const normalized = normalizeSlugs(slugs);
	if (normalized.length < MIN_TOURNAMENTS) {
		throw new Error(`At least ${MIN_TOURNAMENTS} Challonge slugs are required.`);
	}
	const config = { challongeSlugs: normalized };
	await writeFile(await resolveDataFile(CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
	return config;
}
