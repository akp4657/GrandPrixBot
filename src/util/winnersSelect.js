import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';
import { incrementWinner } from './tracking.js';

const CUSTOM_OPEN = 'winners:open';
const CUSTOM_NB = 'winners:nb';

/**
 * @param {'open' | 'nb'} category
 */
export async function replyWithWinnerPicker(interaction, category) {
	const customId = category === 'open' ? CUSTOM_OPEN : CUSTOM_NB;
	const select = new UserSelectMenuBuilder()
		.setCustomId(customId)
		.setPlaceholder('Select a winner')
		.setMinValues(1)
		.setMaxValues(1);

	await interaction.reply({
		content: category === 'open' ? '**Open GP** win.' : '**NEW BLOOD** win.',
		components: [new ActionRowBuilder().addComponents(select)],
		ephemeral: true,
	});
}

/**
 * @param {import('discord.js').UserSelectMenuInteraction} interaction
 */
export async function handleWinnersUserSelect(interaction) {
	const category = interaction.customId === CUSTOM_OPEN ? 'open' : 'nb';
	const user = interaction.users.first();
	if (!user) {
		await interaction.reply({ content: 'No user selected.', ephemeral: true });
		return;
	}
	const username = user.username;
	const total = await incrementWinner(category, username);
	const label = category === 'open' ? 'Open' : 'NB';
	await interaction.update({
		content: `Recorded **${label}** win for **${username}** (total: **${total}**).`,
		components: [],
	});
}

/**
 * @param {string} customId
 */
export function isWinnersUserSelectCustomId(customId) {
	return customId === CUSTOM_OPEN || customId === CUSTOM_NB;
}
