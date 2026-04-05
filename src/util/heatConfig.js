import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HEAT1_PREFIX = 'Heat 1:';
const HEAT2_PREFIX = 'Heat 2:';

/**
 * @param {string} content
 * @param {string} prefix
 * @returns {string | undefined}
 */
function parseLine(content, prefix) {
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.startsWith(prefix)) {
			return trimmed.slice(prefix.length).trim();
		}
	}
	return undefined;
}

/**
 * Reads heat-config.txt from the project root and returns Challonge tournament slugs.
 *
 * @returns {Promise<{ heat1: string; heat2: string }>}
 */
export async function readHeatConfig() {
	const filePath = join(process.cwd(), 'heat-config.txt');
	const content = await readFile(filePath, 'utf-8');
	const heat1 = parseLine(content, HEAT1_PREFIX);
	const heat2 = parseLine(content, HEAT2_PREFIX);
	return { heat1: heat1 ?? '', heat2: heat2 ?? '' };
}

/**
 * @param {1 | 2} heatNumber
 * @returns {Promise<string>}
 */
export async function getHeatSlug(heatNumber) {
	const { heat1, heat2 } = await readHeatConfig();
	const slug = heatNumber === 1 ? heat1 : heat2;
	if (!slug) {
		throw new Error(heatNumber === 1 ? 'Heat 1 is not configured.' : 'Heat 2 is not configured.');
	}
	return slug;
}
