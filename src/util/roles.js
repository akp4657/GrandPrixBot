import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROLES_STATE_FILE = 'roles-state.json';

/**
 * @typedef {{ openChampion: string; openRunnerUp: string; nbChampion: string; nbRunnerUp: string }} RolesState
 */

/** @returns {Promise<RolesState>} */
async function readState() {
	try {
		const raw = await readFile(join(process.cwd(), ROLES_STATE_FILE), 'utf-8');
		return /** @type {RolesState} */ (JSON.parse(raw));
	} catch {
		return { openChampion: '', openRunnerUp: '', nbChampion: '', nbRunnerUp: '' };
	}
}

/** @param {RolesState} state */
async function writeState(state) {
	await writeFile(join(process.cwd(), ROLES_STATE_FILE), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * @param {'open' | 'nb'} category
 * @returns {{ championRoleId: string; runnerUpRoleId: string }}
 */
function getRoleIds(category) {
	const championKey = category === 'open' ? 'ROLE_ID_OPEN_CHAMPION' : 'ROLE_ID_NB_CHAMPION';
	const runnerUpKey = category === 'open' ? 'ROLE_ID_OPEN_RUNNER_UP' : 'ROLE_ID_NB_RUNNER_UP';
	const championRoleId = process.env[championKey];
	const runnerUpRoleId = process.env[runnerUpKey];
	if (!championRoleId || !runnerUpRoleId) {
		throw new Error(`Missing env vars ${championKey} / ${runnerUpKey}.`);
	}
	return { championRoleId, runnerUpRoleId };
}

/**
 * Loads a guild member via REST (works for offline users not in the in-memory cache).
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 */
async function fetchMember(guild, userId) {
	return guild.members.fetch({ user: userId, force: true });
}

/**
 * Remove a role from a specific member by id (if they still have it), then add to the new holder.
 * Uses direct member fetches instead of iterating role.members (avoids GuildMembers privileged intent).
 *
 * @param {import('discord.js').Guild} guild
 * @param {string} roleId
 * @param {string} prevHolderId Previous holder's user id (empty string = none).
 * @param {string} newHolderId New holder's user id.
 * @returns {Promise<{ removedFrom: string; added: boolean }>}
 */
async function reassignRole(guild, roleId, prevHolderId, newHolderId) {
	let removedFrom = '';

	if (prevHolderId && prevHolderId !== newHolderId) {
		try {
			const prev = await fetchMember(guild, prevHolderId);
			if (prev.roles.cache.has(roleId)) {
				await prev.roles.remove(roleId);
				removedFrom = prev.user.username;
			}
		} catch {
			// Member may have left the server; ignore.
		}
	}

	const newMember = await fetchMember(guild, newHolderId);
	const added = !newMember.roles.cache.has(roleId);
	if (added) {
		await newMember.roles.add(roleId);
	}

	return { removedFrom, added };
}

/**
 * Assigns Champion and Runner-Up roles and records state. Champion and runner-up must be
 * different users. Tracking / win counts are handled by the caller (champion only).
 *
 * @param {import('discord.js').Guild} guild
 * @param {'open' | 'nb'} category
 * @param {string} newChampionUserId
 * @param {string} newRunnerUpUserId
 * @returns {Promise<string>} confirmation message
 */
export async function assignBracketRoles(guild, category, newChampionUserId, newRunnerUpUserId) {
	if (newChampionUserId === newRunnerUpUserId) {
		throw new Error('Champion and Runner-Up must be different users.');
	}

	const { championRoleId, runnerUpRoleId } = getRoleIds(category);
	const label = category === 'open' ? 'Open' : 'NB';
	const state = await readState();

	const prevChampKey = category === 'open' ? 'openChampion' : 'nbChampion';
	const prevRuKey = category === 'open' ? 'openRunnerUp' : 'nbRunnerUp';

	const prevChamp = state[prevChampKey] || '';
	const prevRu = state[prevRuKey] || '';

	const champResult = await reassignRole(guild, championRoleId, prevChamp, newChampionUserId);
	const ruResult = await reassignRole(guild, runnerUpRoleId, prevRu, newRunnerUpUserId);

	state[prevChampKey] = newChampionUserId;
	state[prevRuKey] = newRunnerUpUserId;
	await writeState(state);

	const lines = [`**${label} roles assigned.**`];
	if (champResult.removedFrom) lines.push(`Removed ${label} Champion from **${champResult.removedFrom}**.`);
	lines.push(
		champResult.added
			? `Gave ${label} Champion to <@${newChampionUserId}>.`
			: `<@${newChampionUserId}> already held ${label} Champion.`,
	);
	if (ruResult.removedFrom) lines.push(`Removed ${label} Runner-Up from **${ruResult.removedFrom}**.`);
	lines.push(
		ruResult.added
			? `Gave ${label} Runner-Up to <@${newRunnerUpUserId}>.`
			: `<@${newRunnerUpUserId}> already held ${label} Runner-Up.`,
	);

	return lines.join('\n');
}
