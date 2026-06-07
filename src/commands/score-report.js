import { executeScoreReportCommand } from '../util/reportHeat.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'score-report',
		description: 'Report a match score (select from all open matches across heats)',
	},
	async execute(interaction) {
		await executeScoreReportCommand(interaction);
	},
};
