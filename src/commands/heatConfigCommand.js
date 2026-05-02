import process from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ActionRowBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from 'discord.js';
import { readHeatConfig } from '../util/heatConfig.js';
import { readDueDateRaw } from '../util/tracking.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'configure-heat',
		description: 'Configure a heat with details',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		const modal = new ModalBuilder().setCustomId('configure-heat-modal').setTitle('Configure Heat');

		const heat1Input = new TextInputBuilder()
			.setCustomId('heat1')
			.setLabel('Heat 1 (leave blank to keep current)')
			.setStyle(TextInputStyle.Short)
			.setRequired(false)
			.setPlaceholder('Heat 1 Challonge slug');

		const heat2Input = new TextInputBuilder()
			.setCustomId('heat2')
			.setLabel('Heat 2 (leave blank to keep current)')
			.setStyle(TextInputStyle.Short)
			.setRequired(false)
			.setPlaceholder('Heat 2 Challonge slug');

		const dateTimeInput = new TextInputBuilder()
			.setCustomId('datetime')
			.setLabel('Due date (optional)')
			.setStyle(TextInputStyle.Short)
			.setRequired(false)
			.setPlaceholder('Blank = unchanged. YYYY-MM-DD HH:MM or /set-due-date');

		const firstActionRow = new ActionRowBuilder().addComponents(heat1Input);
		const secondActionRow = new ActionRowBuilder().addComponents(heat2Input);
		const thirdActionRow = new ActionRowBuilder().addComponents(dateTimeInput);

		modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

		await interaction.showModal(modal);
	},
};

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleConfigureHeatModal(interaction) {
	const heat1Input = interaction.fields.getTextInputValue('heat1').trim();
	const heat2Input = interaction.fields.getTextInputValue('heat2').trim();
	const dateTimeInput = interaction.fields.getTextInputValue('datetime').trim();

	const current = await readHeatConfig();
	const heat1 = heat1Input || current.heat1;
	const heat2 = heat2Input || current.heat2;
	const dateTime = dateTimeInput || (await readDueDateRaw());

	const filePath = join(process.cwd(), 'tracking.txt');
	const existing = await readFile(filePath, 'utf-8');
	const kept = existing
		.split(/\r?\n/)
		.filter((l) => l.trim() && !l.startsWith('Heat 1:') && !l.startsWith('Heat 2:') && !l.startsWith('DueDate:'))
		.join('\n');
	await writeFile(
		filePath,
		`Heat 1: ${heat1}\nHeat 2: ${heat2}\nDueDate: ${dateTime}\n${kept ? kept + '\n' : ''}`,
		'utf-8',
	);

	await interaction.reply({
		content: [
			'Heat configured successfully!',
			`**Heat 1:** ${heat1 || '(not set)'}`,
			`**Heat 2:** ${heat2 || '(not set)'}`,
			`**Due date:** ${dateTime || '(not set — use /set-due-date)'}`,
		].join('\n'),
		ephemeral: true,
	});
}
