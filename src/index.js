import process from 'node:process';
import { URL } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadEvents } from './util/loaders.js';
import { registerGuildCommands } from './util/registerGuildCommands.js';

await registerGuildCommands();

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Load the events and commands
const events = await loadEvents(new URL('events/', import.meta.url));

// Register the event handlers
for (const event of events) {
	client[event.once ? 'once' : 'on'](event.name, async (...args) => {
		try {
			await event.execute(...args);
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 10062) {
				console.error(
					'Interaction expired (10062). If this persists with instant commands, stop duplicate bot processes — only one npm start should run.',
				);
				return;
			}
			console.error(`Error executing event ${String(event.name)}:`, error);
		}
	});
}

// Login to the client
void client.login(process.env.DISCORD_TOKEN);
