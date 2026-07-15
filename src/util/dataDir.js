import { constants } from 'node:fs';
import { access, copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

/**
 * Directory for mutable state files (tracking, roles, posts).
 * Set `DATA_DIR=/data` on Render when using a persistent disk.
 * Falls back to the process working directory for local development.
 *
 * @returns {string}
 */
export function getDataDir() {
	let dir = (process.env.DATA_DIR ?? '').trim();
	if (
		(dir.startsWith('"') && dir.endsWith('"')) ||
		(dir.startsWith("'") && dir.endsWith("'"))
	) {
		dir = dir.slice(1, -1);
	}
	return dir || process.cwd();
}

/**
 * Absolute path for a state file under {@link getDataDir}.
 * When `DATA_DIR` differs from cwd, ensures the directory exists and seeds
 * the file from the repo copy on first use (if present).
 *
 * @param {string} filename
 * @returns {Promise<string>}
 */
export async function resolveDataFile(filename) {
	const dir = getDataDir();
	const dest = join(dir, filename);

	if (dir !== process.cwd()) {
		await mkdir(dir, { recursive: true });
		try {
			await access(dest, constants.F_OK);
		} catch {
			const src = join(process.cwd(), filename);
			try {
				await copyFile(src, dest);
			} catch {
				// No seed file in the deploy — caller creates on write or handles missing read.
			}
		}
	}

	return dest;
}
