import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_FILE = 'posts-config.txt';

const PREFIXES = /** @type {const} */ ({
	xLinks: 'XLinks: ',
	googleForm: 'GoogleForm: ',
	msg1st: 'GoogleFormMessage1st: ',
	msg15th: 'GoogleFormMessage15th: ',
	msgLast: 'GoogleFormMessageLast: ',
});

/**
 * @typedef {{ xLinks: string[]; googleForm: string; msg1st: string; msg15th: string; msgLast: string }} PostsConfig
 */

/**
 * @param {string} content
 * @returns {PostsConfig}
 */
function parsePostsConfig(content) {
	/** @type {PostsConfig} */
	const out = { xLinks: [], googleForm: '', msg1st: '', msg15th: '', msgLast: '' };
	for (const line of content.split(/\r?\n/)) {
		const t = line.trim();
		if (t.startsWith(PREFIXES.xLinks)) {
			try {
				out.xLinks = /** @type {string[]} */ (JSON.parse(t.slice(PREFIXES.xLinks.length) || '[]'));
			} catch {
				out.xLinks = [];
			}
		} else if (t.startsWith(PREFIXES.googleForm)) {
			out.googleForm = t.slice(PREFIXES.googleForm.length).trim();
		} else if (t.startsWith(PREFIXES.msg1st)) {
			out.msg1st = t.slice(PREFIXES.msg1st.length).trim();
		} else if (t.startsWith(PREFIXES.msg15th)) {
			out.msg15th = t.slice(PREFIXES.msg15th.length).trim();
		} else if (t.startsWith(PREFIXES.msgLast)) {
			out.msgLast = t.slice(PREFIXES.msgLast.length).trim();
		}
	}
	return out;
}

/**
 * @param {PostsConfig} cfg
 */
function serializePostsConfig(cfg) {
	return (
		[
			`${PREFIXES.xLinks}${JSON.stringify(cfg.xLinks)}`,
			`${PREFIXES.googleForm}${cfg.googleForm}`,
			`${PREFIXES.msg1st}${cfg.msg1st}`,
			`${PREFIXES.msg15th}${cfg.msg15th}`,
			`${PREFIXES.msgLast}${cfg.msgLast}`,
		].join('\n') + '\n'
	);
}

/** @returns {Promise<PostsConfig>} */
export async function readPostsConfig() {
	const path = join(process.cwd(), POSTS_FILE);
	try {
		const raw = await readFile(path, 'utf-8');
		return parsePostsConfig(raw);
	} catch {
		return { xLinks: [], googleForm: '', msg1st: '', msg15th: '', msgLast: '' };
	}
}

/** @param {PostsConfig} cfg */
async function writePostsConfig(cfg) {
	await writeFile(join(process.cwd(), POSTS_FILE), serializePostsConfig(cfg), 'utf-8');
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
export async function handlePostsModal(interaction) {
	const rawLinks = interaction.fields.getTextInputValue('x_links').trim();
	const googleForm = interaction.fields.getTextInputValue('google_form').trim();
	const msg1st = interaction.fields.getTextInputValue('msg_1st').trim();
	const msg15th = interaction.fields.getTextInputValue('msg_15th').trim();
	const msgLast = interaction.fields.getTextInputValue('msg_last').trim();

	const xLinks = rawLinks
		? rawLinks
				.split(/[\n,]+/)
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	await writePostsConfig({ xLinks, googleForm, msg1st, msg15th, msgLast });

	await interaction.reply({
		content: [
			'**Posts configured.**',
			`X Links: ${xLinks.length ? xLinks.join(', ') : '(none)'}`,
			`Google Form: ${googleForm || '(none)'}`,
		].join('\n'),
		ephemeral: true,
	});
}
