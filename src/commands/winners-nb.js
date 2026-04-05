import { replyWithWinnerPicker } from '../util/winnersSelect.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'winners-nb',
		description: 'Record a **NEW BLOOD** win',
	},
	async execute(interaction) {
		await replyWithWinnerPicker(interaction, 'nb');
	},
};
