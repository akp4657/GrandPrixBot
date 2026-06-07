import { PermissionFlagsBits } from 'discord.js';

/** @type {import('../index.js').Command} */
export default {
	data: {
		name: 'info',
		description: 'Provides information about the user.',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		await interaction.reply(`This command was run by ${interaction.user.username}.`);
	},
};
