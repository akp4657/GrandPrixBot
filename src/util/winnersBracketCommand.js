import { MessageFlags } from 'discord.js';
import { assignBracketRoles } from './roles.js';
import { incrementWinner } from './tracking.js';

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {'open' | 'nb'} category
 */
export async function runWinnersBracketCommand(interaction, category) {
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	}

	const champion = interaction.options.getUser('champion', true);
	const runnerUp = interaction.options.getUser('runner_up', true);

	try {
		const message = await assignBracketRoles(interaction.guild, category, champion.id, runnerUp.id);
		let trackingLine = '';
		try {
			const total = await incrementWinner(category, champion.id);
			const label = category === 'open' ? 'Open' : 'NB';
			trackingLine = `\nRecorded **${label}** win for <@${champion.id}> (total: **${total}**).`;
		} catch (trackErr) {
			console.error('winners-bracket: incrementWinner failed:', trackErr);
			trackingLine = '\n**Warning:** roles updated but `tracking.txt` win count failed — check logs.';
		}
		await interaction.editReply({ content: message + trackingLine });
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await interaction.editReply({ content: `Error: ${msg}` });
	}
}
