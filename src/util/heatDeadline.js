import cron from 'node-cron';
import { getConfiguredHeatSlugs } from './heatConfig.js';
import { closeMatchAsDraw, listOpenMatches } from './challonge.js';
import {
	DUE_DATE_FORMAT,
	parseDueDateEst,
	readDueDateClosedCount,
	readDueDateMatchesClosedRaw,
	readDueDateNotifiedRaw,
	readDueDateRaw,
	writeDueDate,
	writeDueDateMatchesClosed,
	writeDueDateNotified,
} from './tracking.js';
import { notifyAdminDeadlinePassed } from './adminNotify.js';

/** Admin post is sent this long after the due date (US Eastern). */
const ADMIN_NOTIFY_DELAY_MS = 1 * 60 * 1000;

/**
 * @param {string} dueDateRaw
 * @returns {Promise<number>}
 */
async function closeOpenMatchesForDeadline(dueDateRaw) {
	const slugs = await getConfiguredHeatSlugs();

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

	await writeDueDateMatchesClosed(dueDateRaw, closedCount);
	return closedCount;
}

/**
 * @param {import('discord.js').Client} client
 */
async function tick(client) {
	const dueDateRaw = await readDueDateRaw();
	if (!dueDateRaw) return;

	const dueDate = parseDueDateEst(dueDateRaw);
	if (!dueDate) {
		console.error(`heatDeadline: unparseable DueDate "${dueDateRaw}" (expected ${DUE_DATE_FORMAT})`);
		return;
	}

	const now = Date.now();
	const dueMs = dueDate.getTime();
	if (now < dueMs) return;

	const matchesClosedFor = await readDueDateMatchesClosedRaw();
	if (matchesClosedFor !== dueDateRaw) {
		await closeOpenMatchesForDeadline(dueDateRaw);
	}

	const notifyAt = dueMs + ADMIN_NOTIFY_DELAY_MS;
	if (now < notifyAt) return;

	const alreadyNotified = await readDueDateNotifiedRaw();
	if (alreadyNotified === dueDateRaw) {
		await writeDueDate('');
		return;
	}

	const closedCount = await readDueDateClosedCount();

	try {
		await notifyAdminDeadlinePassed(client, { closedCount, dueDateRaw });
		await writeDueDateNotified(dueDateRaw);
		await writeDueDate('');
	} catch (err) {
		console.error('heatDeadline: admin post failed — will retry on next tick:', err);
	}
}

/**
 * @param {import('discord.js').Client} client
 */
export function startHeatDeadlineWatcher(client) {
	cron.schedule('* * * * *', () => {
		tick(client).catch((err) => console.error('heatDeadline tick:', err));
	});
}
