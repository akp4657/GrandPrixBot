import { Events } from 'discord.js';
import { loadCommands } from '../util/loaders.js';
import {
	handleReportHeatScoreModal,
	handleReportHeatSelect,
	parseHeatFromSelectCustomId,
	parseHeatScoreModalCustomId,
} from '../util/reportHeat.js';
import { handlePostsModal } from '../util/postsConfig.js';
import { handleConfigureHeatModal } from '../commands/heatConfigCommand.js';
const commands = await loadCommands(new URL('../commands/', import.meta.url));

/** @type {import('../events/index.js').Event<Events.InteractionCreate>} */
export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
			const command = commands.get(interaction.commandName);
			console.log(command);

			if (!command) {
				throw new Error(`Command '${interaction.commandName}' not found.`);
			}

			await command.execute(interaction);
		} else if (interaction.isStringSelectMenu()) {
			if (parseHeatFromSelectCustomId(interaction) !== null) {
				await handleReportHeatSelect(interaction);
			}
		} else if (interaction.isModalSubmit()) {
			if (parseHeatScoreModalCustomId(interaction)) {
				await handleReportHeatScoreModal(interaction);
			} else if (interaction.customId === 'posts-modal') {
				await handlePostsModal(interaction);
			} else if (interaction.customId === 'configure-heat-modal') {
				await handleConfigureHeatModal(interaction);
			}
		}
	},
};
