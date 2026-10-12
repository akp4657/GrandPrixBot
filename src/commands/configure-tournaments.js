import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { writeTournamentConfig } from '../util/tournamentConfig.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'configure-tournaments',
		description: 'Set the Challonge tournaments used for score reporting',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'slugs',
				description: 'Comma-separated Challonge slugs (minimum two)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const slugs = interaction.options.getString('slugs', true).split(',');
			const config = await writeTournamentConfig(slugs);
			await interaction.editReply({
				content: `Configured ${config.challongeSlugs.length} Challonge tournaments:\n${config.challongeSlugs
					.map((slug) => `• ${slug}`)
					.join('\n')}`,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await interaction.editReply({ content: `Configuration failed: ${message}` });
		}
	},
};
