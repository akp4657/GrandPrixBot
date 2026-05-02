import cron from 'node-cron';
import { readHeatConfig } from './heatConfig.js';
import { closeMatchAsDraw, listOpenMatches } from './challonge.js';
import { readDueDate, writeDueDate } from './tracking.js';
import { notifyAdminDeadlinePassed } from './adminNotify.js';

/**
 * @param {import('discord.js').Client} client
 */
async function tick(client) {
	const dueDate = await readDueDate();
	if (!dueDate || Date.now() < dueDate.getTime()) return;

	const { heat1, heat2 } = await readHeatConfig();
	const slugs = [heat1, heat2].filter(Boolean);

	let closedCount = 0;
	for (const slug of slugs) {
		let openMatches;
		try {
			openMatches = await listOpenMatches(slug);
		} catch (err) {
			console.error(`heatDeadline: failed to list open matches for ${slug}:`, err);
			continue;
		}

		for (const match of openMatches) {
			try {
				await closeMatchAsDraw(slug, match.id);
				closedCount++;
			} catch (err) {
				console.error(`heatDeadline: failed to close match ${match.id} (${match.label}) in ${slug}:`, err);
			}
		}
	}

	// Clear the due date first so a bot restart cannot re-trigger.
	await writeDueDate('');

	await notifyAdminDeadlinePassed(client, { closedCount }).catch((err) =>
		console.error('heatDeadline: admin DM failed:', err),
	);
}

/**
 * @param {import('discord.js').Client} client
 */
export function startHeatDeadlineWatcher(client) {
	cron.schedule('* * * * *', () => {
		tick(client).catch((err) => console.error('heatDeadline tick:', err));
	});
}
