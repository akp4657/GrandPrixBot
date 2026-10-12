import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { readWinnerState } from '../util/winnerState.js';

async function formatWinnerList(client, counts) {
	return Promise.all(
		Object.entries(counts)
			.sort(([, a], [, b]) => b - a)
			.map(async ([userId, wins]) => {
				try {
					const user = await client.users.fetch(userId);
					return { player: user.globalName ?? user.username, wins };
				} catch {
					return { player: userId, wins };
				}
			}),
	);
}

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'winner-counts',
		description: 'Show Open and NB winner totals as formatted JSON',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const state = await readWinnerState();
			const output = {
				open: await formatWinnerList(interaction.client, state.winnersOpen),
				nb: await formatWinnerList(interaction.client, state.winnersNB),
			};
			await interaction.editReply({
				content: `\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await interaction.editReply({ content: `Could not load winner counts: ${message}` });
		}
	},
};
