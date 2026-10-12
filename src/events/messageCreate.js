import process from 'node:process';
import { Events } from 'discord.js';
import { listReportableMatches, updateMatchScores } from '../util/challonge.js';
import { findReportedMatch } from '../util/participantMatcher.js';
import { readTournamentConfig } from '../util/tournamentConfig.js';
import { parseScoreMessage } from '../util/scoreParser.js';

const INPUT_CHANNEL_ID = process.env.DISCORD_POSTS_CHANNEL_ID;
const ADMIN_CHANNEL_ID = process.env.ADMIN_POSTS_CHANNEL_ID;
const EMOJI_ID_SUCCESS = process.env.EMOJI_ID_SUCCESS;

async function reportFailure(client, message, reason) {
	if (!ADMIN_CHANNEL_ID) {
		console.error(`score message failed (${message.id}): ${reason}`);
		return;
	}
	try {
		const channel = await client.channels.fetch(ADMIN_CHANNEL_ID);
		if (channel?.isTextBased()) {
			await channel.send(`Score report failed for <#${message.channelId}> from <@${message.author.id}>: ${reason}`);
		}
	} catch (error) {
		console.error('Failed to post score-report error:', error);
	}
}

/** @type {import('./index.js').Event<Events.MessageCreate>} */
export default {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot || !INPUT_CHANNEL_ID || message.channelId !== INPUT_CHANNEL_ID) return;

		const parsed = parseScoreMessage(message.content);
		if (!parsed) return;

		try {
			const { challongeSlugs } = await readTournamentConfig();
			const candidates = [];
			for (const slug of challongeSlugs) {
				const matches = await listReportableMatches(slug);
				const result = findReportedMatch(message, parsed, matches);
				if (result) candidates.push({ slug, ...result });
			}

			if (candidates.length !== 1) {
				throw new Error(
					candidates.length === 0
						? 'No unique open match matched both reported players.'
						: 'The reported players matched open matches in multiple tournaments.',
				);
			}

			const { slug, match, reversed } = candidates[0];
			const reportedWinnerIsPlayer1 = parsed.player1Score > parsed.player2Score;
			const winnerId = reversed
				? reportedWinnerIsPlayer1
					? match.player2Id
					: match.player1Id
				: reportedWinnerIsPlayer1
					? match.player1Id
					: match.player2Id;
			if (winnerId === null) throw new Error('The matched Challonge participants are incomplete.');

			const score = reversed
				? `${parsed.player2Score}-${parsed.player1Score}`
				: `${parsed.player1Score}-${parsed.player2Score}`;
			await updateMatchScores(slug, match.id, score, winnerId);
			await message.react(EMOJI_ID_SUCCESS);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			await reportFailure(message.client, message, reason);
		}
	},
};
