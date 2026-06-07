import {
	ActionRowBuilder,
	MessageFlags,
	ModalBuilder,
	PermissionFlagsBits,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import { listHeats, parseHeatLines, readHeatConfig } from '../util/heatConfig.js';
import { readDueDateRaw, writeHeatConfiguration, DUE_DATE_FORMAT, normalizeDueDateString } from '../util/tracking.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'configure-heat',
		description: 'Configure heats and due date',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		const modal = new ModalBuilder().setCustomId('configure-heat-modal').setTitle('Configure Heats');

		const heatsInput = new TextInputBuilder()
			.setCustomId('heats')
			.setLabel('Heats (one per line: Heat N: slug)')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(false)
			.setPlaceholder('Heat 1: slug\nHeat 2: slug\n...\nBlank = keep current heats');

		const dateTimeInput = new TextInputBuilder()
			.setCustomId('datetime')
			.setLabel('Due date (optional)')
			.setStyle(TextInputStyle.Short)
			.setRequired(false)
			.setPlaceholder(`Blank = unchanged. ${DUE_DATE_FORMAT}`);

		modal.addComponents(
			new ActionRowBuilder().addComponents(heatsInput),
			new ActionRowBuilder().addComponents(dateTimeInput),
		);

		await interaction.showModal(modal);
	},
};

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handleConfigureHeatModal(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const heatsInput = interaction.fields.getTextInputValue('heats').trim();
	const dateTimeInput = interaction.fields.getTextInputValue('datetime').trim();

	const heats = heatsInput ? parseHeatLines(heatsInput) : await readHeatConfig();
	let dateTime = dateTimeInput || (await readDueDateRaw());
	if (dateTimeInput) {
		const normalized = normalizeDueDateString(dateTimeInput);
		if (!normalized) {
			await interaction.editReply({
				content: `Invalid due date: \`${dateTimeInput}\`. Use ${DUE_DATE_FORMAT} (example: \`2026-06-12 23:59\`).`,
			});
			return;
		}
		dateTime = normalized;
	}

	await writeHeatConfiguration({ heats, dueDate: dateTime });

	const heatLines = (await listHeats()).map(
		({ number, slug }) => `**Heat ${number}:** ${slug || '(not set)'}`,
	);

	await interaction.editReply({
		content: [
			'Heat configuration saved.',
			heatLines.length ? heatLines.join('\n') : '(no heats configured)',
			`**Due date:** ${dateTime || '(not set — use /set-due-date)'}`,
		].join('\n'),
	});
}
