import { ActionRowBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from 'discord.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'posts',
		description: 'Configure scheduled Discord posts (X links, Google Form messages)',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		const modal = new ModalBuilder().setCustomId('posts-modal').setTitle('Configure Posts');

		const xLinksInput = new TextInputBuilder()
			.setCustomId('x_links')
			.setLabel('X Link(s) (comma or newline separated)')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false)
			.setPlaceholder('https://x.com/...');

		const googleFormInput = new TextInputBuilder()
			.setCustomId('google_form')
			.setLabel('Google Form URL')
			.setStyle(TextInputStyle.Short)
			.setRequired(false)
			.setPlaceholder('https://forms.gle/...');

		const msg1stInput = new TextInputBuilder()
			.setCustomId('msg_1st')
			.setLabel('Google Form Message (1st of month)')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false);

		const msg15thInput = new TextInputBuilder()
			.setCustomId('msg_15th')
			.setLabel('Google Form Message (15th of month)')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false);

		const msgLastInput = new TextInputBuilder()
			.setCustomId('msg_last')
			.setLabel('Google Form Message (Last day of month)')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false);

		modal.addComponents(
			new ActionRowBuilder().addComponents(xLinksInput),
			new ActionRowBuilder().addComponents(googleFormInput),
			new ActionRowBuilder().addComponents(msg1stInput),
			new ActionRowBuilder().addComponents(msg15thInput),
			new ActionRowBuilder().addComponents(msgLastInput),
		);

		await interaction.showModal(modal);
	},
};
