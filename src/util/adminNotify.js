import process from 'node:process';
import { challongeTournamentUrl } from './challonge.js';

const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const ADMIN_POSTS_CHANNEL_ID = process.env.ADMIN_POSTS_CHANNEL_ID;

/**
 * @param {import('discord.js').Client} client
 * @returns {Promise<{ channel: import('discord.js').TextBasedChannel; mention: string }>}
 */
async function fetchAdminPostTarget(client) {
	if (!ADMIN_POSTS_CHANNEL_ID) {
		throw new Error('ADMIN_POSTS_CHANNEL_ID is not set in environment.');
	}

	const channel = await client.channels.fetch(ADMIN_POSTS_CHANNEL_ID);
	if (!channel?.isTextBased()) {
		throw new Error(`Channel ${ADMIN_POSTS_CHANNEL_ID} is not a text channel.`);
	}

	const mention = ADMIN_USER_ID ? `<@${ADMIN_USER_ID}>` : '';
	if (!ADMIN_USER_ID) {
		console.warn('adminNotify: ADMIN_USER_ID is not set — posting without a user mention.');
	}

	return { channel, mention };
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} content
 */
async function postAdminNotice(client, content) {
	const target = await fetchAdminPostTarget(client);
	const body = target.mention ? `${target.mention}\n${content}` : content;
	await target.channel.send(body);
}

/**
 * @param {import('discord.js').Client} client
 * @param {{ closedCount: number; dueDateRaw: string }} opts
 */
export async function notifyAdminDeadlinePassed(client, { closedCount, dueDateRaw }) {
	await postAdminNotice(
		client,
		[
			'**Round deadline passed.**',
			`Due date: **${dueDateRaw}** (24-hour US Eastern)`,
			`${closedCount} open match(es) were reported as 0-0 draws.`,
		].join('\n'),
	);
}

/**
 * @param {import('discord.js').Client} client
 * @param {{ heatNumber: number; slug: string; round: number }} opts
 */
export async function notifyAdminRoundComplete(client, { heatNumber, slug, round }) {
	const url = challongeTournamentUrl(slug);
	await postAdminNotice(
		client,
		[
			'**Bracket round finished**',
			`Heat **${heatNumber}**: ${url}`,
			`Round **${round}** — all matches are complete for this heat`,
		].join('\n'),
	);
}
