import process from 'node:process';
import { challongeTournamentUrl } from './challonge.js';

/** Discord user id of the admin to DM; set ADMIN_USER_ID in .env. */
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

async function fetchAdmin(client) {
	if (!ADMIN_USER_ID) {
		console.warn('adminNotify: ADMIN_USER_ID is not set — skipping DM.');
		return null;
	}
	return client.users.fetch(ADMIN_USER_ID);
}

/**
 * @param {import('discord.js').Client} client
 * @param {{ closedCount: number }} opts
 */
export async function notifyAdminDeadlinePassed(client, { closedCount }) {
	const user = await fetchAdmin(client);
	if (!user) return;
	await user.send(
		`**Heat deadline passed.** ${closedCount} open match(es) were auto-closed as 0-0 draws.\n` +
			`Please use \`/set-due-date\` to set the next deadline.`,
	);
}

/**
 * @param {import('discord.js').Client} client
 * @param {{ heatNumber: 1 | 2; slug: string; round: number }} opts
 */
export async function notifyAdminRoundComplete(client, { heatNumber, slug, round }) {
	const user = await fetchAdmin(client);
	if (!user) return;
	const url = challongeTournamentUrl(slug);
	await user.send(
		[
			'**Bracket round finished**',
			`Heat **${heatNumber}**: ${url}`,
			`Round **${round}** — all matches in this round are now complete on Challonge.`,
		].join('\n'),
	);
}
