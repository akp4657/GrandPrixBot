import { executeReportHeatCommand } from '../util/reportHeat.js';

/** @type {import('./index.js').Command} */
export default {
	data: {
		name: 'report-heat1',
		description: 'Report a match score for Heat 1 (Challonge bracket from configure-heat)',
	},
	async execute(interaction) {
		await executeReportHeatCommand(interaction, 1);
	},
};
