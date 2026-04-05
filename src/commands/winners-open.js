import { replyWithWinnerPicker } from '../util/winnersSelect.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'winners-open',
		description: 'Record an **Open GP** win',
	},
	async execute(interaction) {
		await replyWithWinnerPicker(interaction, 'open');
	},
};
