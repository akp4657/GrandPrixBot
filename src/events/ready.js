import { Events } from 'discord.js';
import { startHeatDeadlineWatcher } from '../util/heatDeadline.js';
import { startPostsScheduler } from '../util/postsScheduler.js';

/** @type {import('./index.js').Event<Events.ClientReady>} */
export default {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		startPostsScheduler(client);
		startHeatDeadlineWatcher(client);
	},
};
