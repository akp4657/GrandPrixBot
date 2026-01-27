import { Events } from 'discord.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadCommands } from '../util/loaders.js';

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
		} else if (interaction.isModalSubmit()) {
			if (interaction.customId === 'configure-heat-modal') {
				const heat1 = interaction.fields.getTextInputValue('heat1');
				const heat2 = interaction.fields.getTextInputValue('heat2');
				const dateTime = interaction.fields.getTextInputValue('datetime');

				// Parse the date/time input and convert to Unix timestamp (local timezone)
				let timestamp;
				try {
					// Convert our full date string to an actual date
					const date = new Date(dateTime);
					
					// Convert to Unix timestamp for local timestamp
					timestamp = Math.floor(date.getTime() / 1000);
				} catch (error) {
					await interaction.reply({
						content: `Error: ${error.message}`,
						ephemeral: true,
					});
					return;
				}

				// Create Discord timestamp string (format: f = short date/time)
				const discordTimestamp = `<t:${timestamp}:f>`;

				// Create the data to write (store both raw input and Discord timestamp)
				const data = `Heat 1: ${heat1}\nHeat 2: ${heat2}\nDate/Time Input: ${dateTime}\nDiscord Timestamp: ${discordTimestamp}\n`;

				// Write to a txt file
				const filePath = join(process.cwd(), 'heat-config.txt');
				await writeFile(filePath, data, 'utf-8');

				await interaction.reply({
					content: `Heat configured successfully!\n**Heat 1:** ${heat1}\n**Heat 2:** ${heat2}\n**Date/Time:** ${discordTimestamp}`,
					ephemeral: true,
				});
			}
		}
	},
};
