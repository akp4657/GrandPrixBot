import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { runWinnersBracketCommand } from '../util/winnersBracketCommand.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'winners-nb',
		description: 'NB: set Champion (tracked) and Runner-Up roles (admin only)',
		defaultMemberPermissions: String(PermissionFlagsBits.Administrator),
		options: [
			{
				name: 'champion',
				description: 'New NB Champion — win count is recorded for this user only',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
			{
				name: 'runner_up',
				description: 'NB Runner-Up — role only (not added to tracking)',
				type: ApplicationCommandOptionType.User,
				required: true,
			},
		],
	},
	async execute(interaction) {
		await runWinnersBracketCommand(interaction, 'nb');
	},
};
