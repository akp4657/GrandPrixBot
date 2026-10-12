import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { importWinnerState } from '../util/winnerState.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'import-winner-counts',
		description: 'Replace winner counts using a JSON file (admin only)',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'file',
				description: 'JSON file containing open and nb winner arrays',
				type: ApplicationCommandOptionType.Attachment,
				required: true,
			},
		],
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const attachment = interaction.options.getAttachment('file', true);

		try {
			if (!attachment.name.toLowerCase().endsWith('.json')) {
				throw new Error('Attach a .json file.');
			}
			if (attachment.size > 1_000_000) {
				throw new Error('The JSON file must be smaller than 1 MB.');
			}

			const response = await fetch(attachment.url);
			if (!response.ok) {
				throw new Error(`Could not download the attachment (HTTP ${response.status}).`);
			}
			const payload = JSON.parse(await response.text());
			const result = await importWinnerState(payload);
			await interaction.editReply({
				content: [
					'Winner counts imported successfully.',
					`Open players: **${result.openCount}**`,
					`NB players: **${result.nbCount}**`,
					result.backupPath ? 'The previous state was backed up on the data disk.' : 'No previous state existed.',
				].join('\n'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await interaction.editReply({ content: `Winner count import failed: ${message}` });
		}
	},
};
