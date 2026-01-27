import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'configure-heat',
		description: 'Configure a heat with details',
	},
	async execute(interaction) {
		// Create the modal
		const modal = new ModalBuilder()
			.setCustomId('configure-heat-modal')
			.setTitle('Configure Heat');

		// Create text input components
		const heat1Input = new TextInputBuilder()
			.setCustomId('heat1')
			.setLabel('Heat 1')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setPlaceholder('Heat 1 ID');

		const heat2Input = new TextInputBuilder()
			.setCustomId('heat2')
			.setLabel('Heat 2')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setPlaceholder('Heat 2 ID');

		const dateTimeInput = new TextInputBuilder()
			.setCustomId('datetime')
			.setLabel('Date & Time')
			.setStyle(TextInputStyle.Short)
			.setRequired(true)
			.setPlaceholder('YYYY-MM-DD HH:MM (24h)');

		// Add inputs to action rows
		const firstActionRow = new ActionRowBuilder().addComponents(heat1Input);
		const secondActionRow = new ActionRowBuilder().addComponents(heat2Input);
		const thirdActionRow = new ActionRowBuilder().addComponents(dateTimeInput);

		// Add action rows to modal
		modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

		// Show the modal
		await interaction.showModal(modal);
	},
};
