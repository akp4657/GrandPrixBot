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
 * Paginate through every guild member via REST so role cleanup is exhaustive.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').Collection<string, import('discord.js').GuildMember>>}
 */
async function fetchAllGuildMembers(guild) {
	/** @type {import('discord.js').Collection<string, import('discord.js').GuildMember>} */
	let members = await guild.members.fetch({ limit: 1000 });

	while (members.size < guild.memberCount) {
		const lastId = members.lastKey();
		if (!lastId) {
			break;
		}

		const next = await guild.members.fetch({ limit: 1000, after: lastId });
		if (next.size === 0) {
			break;
		}

		members = members.concat(next);
	}

	return members;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} userId
 */
async function fetchMember(guild, userId) {
	return guild.members.fetch({ user: userId, force: true });
}

/**
 * Remove a role from every member except the sole holder.
 *
 * @param {import('discord.js').Collection<string, import('discord.js').GuildMember>} members
 * @param {string} roleId
 * @param {string} keepUserId
 * @returns {Promise<string[]>}
 */
async function stripRoleFromAllMembers(members, roleId, keepUserId) {
	/** @type {string[]} */
	const removedFrom = [];

	for (const member of members.values()) {
		if (member.id === keepUserId || !member.roles.cache.has(roleId)) {
			continue;
		}

		try {
			await member.roles.remove(roleId);
			removedFrom.push(member.user.username);
		} catch (err) {
			console.error(`roles: failed to remove role ${roleId} from ${member.id}:`, err);
		}
	}

	return removedFrom;
}

/**
 * Ensure exactly one member holds a role: strip everyone else, then give it to the holder.
 *
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Collection<string, import('discord.js').GuildMember>} members
 * @param {string} roleId
 * @param {string} holderUserId
 * @returns {Promise<{ removedFrom: string[]; added: boolean }>}
 */
async function assignExclusiveRole(guild, members, roleId, holderUserId) {
	const removedFrom = await stripRoleFromAllMembers(members, roleId, holderUserId);

	const holder = await fetchMember(guild, holderUserId);
	const added = !holder.roles.cache.has(roleId);
	if (added) {
		await holder.roles.add(roleId);
	}

	// Belt-and-suspenders: refresh member list and strip any stragglers missed by cache.
	const refreshed = await fetchAllGuildMembers(guild);
	const stragglers = await stripRoleFromAllMembers(refreshed, roleId, holderUserId);
	for (const name of stragglers) {
		if (!removedFrom.includes(name)) {
			removedFrom.push(name);
		}
	}

	return { removedFrom, added };
}

/**
 * Assigns Champion and Runner-Up roles and records state. Champion and runner-up must be
 * different users. Each role ends up on exactly one member. Tracking / win counts are
 * handled by the caller (champion only).
 *
 * @param {import('discord.js').Guild} guild
 * @param {'open' | 'nb'} category
 * @param {string} newChampionUserId
 * @param {string} newRunnerUpUserId
 * @returns {Promise<string>}
 */
export async function assignBracketRoles(guild, category, newChampionUserId, newRunnerUpUserId) {
	if (newChampionUserId === newRunnerUpUserId) {
		throw new Error('Champion and Runner-Up must be different users.');
	}

	const { championRoleId, runnerUpRoleId } = getRoleIds(category);
	const label = category === 'open' ? 'Open' : 'NB';
	const state = await readState();
	const members = await fetchAllGuildMembers(guild);

	const prevChampKey = category === 'open' ? 'openChampion' : 'nbChampion';
	const prevRuKey = category === 'open' ? 'openRunnerUp' : 'nbRunnerUp';

	const champResult = await assignExclusiveRole(guild, members, championRoleId, newChampionUserId);
	const ruResult = await assignExclusiveRole(guild, members, runnerUpRoleId, newRunnerUpUserId);

	state[prevChampKey] = newChampionUserId;
	state[prevRuKey] = newRunnerUpUserId;
	await writeState(state);

	return `**${label} roles assigned.**`;
}
