import process from 'node:process';
import cron from 'node-cron';
import { readPostsConfig } from './postsConfig.js';

/** IANA timezone for post crons (e.g. America/New_York). Defaults to UTC. */
const CRON_TZ = process.env.DISCORD_POSTS_CRON_TZ || 'UTC';

/** Optional role mention prepended to every scheduled post. */
const ROLE_PING = process.env.GRAND_PRIX_ROLE_ID ? `<@&${process.env.GRAND_PRIX_ROLE_ID}>\n` : '';

const cronOpts = { timezone: CRON_TZ };

/**
 * Calendar year / month (0–11) / day in a given IANA timezone.
 *
 * @param {Date} date
 * @param {string} timeZone
 */
function ymdInTimeZone(date, timeZone) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
	}).formatToParts(date);
	const y = Number(parts.find((p) => p.type === 'year')?.value);
	const m = Number(parts.find((p) => p.type === 'month')?.value) - 1;
	const d = Number(parts.find((p) => p.type === 'day')?.value);
	return { y, m, d };
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 * @returns {Promise<import('discord.js').TextBasedChannel>}
 */
async function fetchChannel(client, channelId) {
	const ch = await client.channels.fetch(channelId);
	if (!ch?.isTextBased()) throw new Error(`Channel ${channelId} is not a text channel.`);
	return ch;
}

/**
 * @param {import('discord.js').Client} client
 */
export function startPostsScheduler(client) {
	const channelId = process.env.DISCORD_POSTS_CHANNEL_ID;
	if (!channelId) {
		console.warn('postsScheduler: DISCORD_POSTS_CHANNEL_ID is not set — scheduler will not run.');
		return;
	}

	console.log(`postsScheduler: timezone=${CRON_TZ}`);

	// Weekly X links — Monday 09:00 in CRON_TZ.
	cron.schedule(
		'0 9 * * 1',
		async () => {
			const cfg = await readPostsConfig();
			if (!cfg.xLinks.length) return;
			const ch = await fetchChannel(client, channelId);
			await ch.send(`${ROLE_PING}${cfg.xLinks.join('\n')}`);
		},
		cronOpts,
	);

	// Google Form — 1st of month 09:00.
	cron.schedule(
		'0 9 1 * *',
		async () => {
			const cfg = await readPostsConfig();
			if (!cfg.googleForm || !cfg.msg1st) return;
			const ch = await fetchChannel(client, channelId);
			await ch.send(`${ROLE_PING}${cfg.msg1st}\n${cfg.googleForm}`);
		},
		cronOpts,
	);

	// Google Form — 15th 09:00.
	cron.schedule(
		'0 9 15 * *',
		async () => {
			const cfg = await readPostsConfig();
			if (!cfg.googleForm || !cfg.msg15th) return;
			const ch = await fetchChannel(client, channelId);
			await ch.send(`${ROLE_PING}${cfg.msg15th}\n${cfg.googleForm}`);
		},
		cronOpts,
	);

	// Last day of month — run 09:00 on 28–31, post only when today is the true last day.
	cron.schedule(
		'0 9 28-31 * *',
		async () => {
			const now = new Date();
			const { y, m, d } = ymdInTimeZone(now, CRON_TZ);
			const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
			if (d !== lastDayOfMonth) return;

			const cfg = await readPostsConfig();
			if (!cfg.googleForm || !cfg.msgLast) return;
			const ch = await fetchChannel(client, channelId);
			await ch.send(`${ROLE_PING}${cfg.msgLast}\n${cfg.googleForm}`);
		},
		cronOpts,
	);
}
