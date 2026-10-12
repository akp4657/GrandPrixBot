import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { runWinnersBracketCommand } from '../util/winnersBracketCommand.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'winners',
		description: 'Set winner/runner-up for open bracket',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'champion',
				description: 'Open Champion',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'runner_up',
				description: 'Open Runner-Up',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		await runWinnersBracketCommand(interaction, 'open');
	},
};
