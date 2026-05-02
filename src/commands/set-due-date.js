import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { writeDueDate } from '../util/tracking.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'set-due-date',
		description: 'Set the heat deadline (admin only). Open matches auto-close as 0-0 draws when it passes.',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'date',
				description: 'Deadline in YYYY-MM-DD HH:MM format (24h, local server time)',
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	async execute(interaction) {
		const dateStr = interaction.options.getString('date', true).trim();
		const parsed = new Date(dateStr);

		if (Number.isNaN(parsed.getTime())) {
			await interaction.reply({
				content: `Invalid date: \`${dateStr}\`. Use format \`YYYY-MM-DD HH:MM\`.`,
				ephemeral: true,
			});
			return;
		}

		await writeDueDate(dateStr);
		await interaction.reply({
			content: `Due date set to **${dateStr}**. Open matches will auto-close as 0-0 draws when this time passes.`,
			ephemeral: true,
		});
	},
};
