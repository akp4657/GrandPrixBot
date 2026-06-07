import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { DUE_DATE_FORMAT, normalizeDueDateString, parseDueDateEst, writeDueDate } from '../util/tracking.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'set-due-date',
		description: 'Set the heat deadline (admin only). Open matches auto-close as 0-0 draws when it passes.',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'date',
				description: `Deadline in ${DUE_DATE_FORMAT}`,
				type: ApplicationCommandOptionType.String,
				required: true,
			},
		],
	},
	async execute(interaction) {
		const dateStr = interaction.options.getString('date', true).trim();

		const normalized = normalizeDueDateString(dateStr);
		if (!normalized || !parseDueDateEst(normalized)) {
			await interaction.reply({
				content: `Invalid date: \`${dateStr}\`. Use ${DUE_DATE_FORMAT} (example: \`2026-06-12 23:59\`).`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await writeDueDate(normalized);
		await interaction.reply({
			content: `Due date set to **${normalized}** (24-hour US Eastern). Open matches will auto-close as 0-0 draws when this time passes; the admin will be notified in the admin posts channel 5 minutes later.`,
			flags: MessageFlags.Ephemeral,
		});
	},
};
