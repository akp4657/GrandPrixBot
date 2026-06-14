import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { challongeTournamentUrl } from '../util/challonge.js';
import { resetAllHeats } from '../util/resetRound.js';

/**
 * @param {import('../util/resetRound.js').ResetHeatResult} result
 * @returns {string}
 */
function formatHeatReset(result) {
	const url = challongeTournamentUrl(result.slug);
	return [
		`**Heat ${result.heatNumber}** — ${url}`,
		`Closed **${result.closedCount}** in round **${result.currentRound}**; reopened **${result.reopenedCount}** in round **${result.previousRound}**.`,
	].join('\n');
}

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'reset',
		description: 'Close the current round and reopen the previous round for all heats (admin only)',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const { results, failures } = await resetAllHeats();

			const lines = ['**Reset applied to all heats.**', ''];
			for (const result of results) {
				lines.push(formatHeatReset(result));
			}

			if (failures.length > 0) {
				lines.push('', '**Skipped:**');
				for (const { heatNumber, error } of failures) {
					lines.push(`• Heat ${heatNumber}: ${error}`);
				}
			}

			await interaction.editReply({ content: lines.join('\n') });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await interaction.editReply({ content: `Reset failed: ${message}` });
		}
	},
};
