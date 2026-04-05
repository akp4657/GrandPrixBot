import { ActionRowBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { challongeTournamentUrl, getMatchDisplayNames, listReportableMatches, updateMatchScores } from './challonge.js';
import { getHeatSlug } from './heatConfig.js';

const MAX_SELECT_OPTIONS = 25;
/** Discord modal text input labels max length. */
const MODAL_LABEL_MAX = 45;

const EXTRA_SETS_PATTERN = /^(\d+-\d+)(,\d+-\d+)*$/;

/** Challonge winner: higher round count wins if that count is at least this many. */
const ROUNDS_TO_WIN = 3;

/**
 * Higher round total wins; winner must have at least {@link ROUNDS_TO_WIN} rounds.
 * Bye slot → the other participant wins.
 *
 * @param {number} p1Rounds
 * @param {number} p2Rounds
 * @param {number | null} player1Id
 * @param {number | null} player2Id
 * @returns {number | 'tie' | null}
 */
function resolveWinnerId(p1Rounds, p2Rounds, player1Id, player2Id) {
	if (player1Id === null && player2Id !== null) {
		return player2Id;
	}
	if (player2Id === null && player1Id !== null) {
		return player1Id;
	}
	if (player1Id === null || player2Id === null) {
		return null;
	}

	const top = Math.max(p1Rounds, p2Rounds);
	if (top < ROUNDS_TO_WIN) {
		return null;
	}

	if (p1Rounds > p2Rounds) {
		return player1Id;
	}
	if (p2Rounds > p1Rounds) {
		return player2Id;
	}
	return null;
}

/**
 * @param {string} displayName
 * @returns {string}
 */
function modalGamesLabel(displayName) {
	const label = `${displayName}`;
	return label.length > MODAL_LABEL_MAX ? label.slice(0, MODAL_LABEL_MAX) : label;
}

/**
 * @param {1 | 2} heatNumber
 * @param {number} matchId
 * @returns {string}
 */
export function reportHeatScoreModalCustomId(heatNumber, matchId) {
	return `reportHeat:${heatNumber}:score:${matchId}`;
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @returns {1 | 2 | null}
 */
export function parseHeatFromSelectCustomId(interaction) {
	const m = interaction.customId.match(/^reportHeat:(1|2):match$/);
	if (!m) {
		return null;
	}
	return /** @type {1 | 2} */ (Number(m[1]));
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @returns {{ heatNumber: 1 | 2; matchId: number } | null}
 */
export function parseHeatScoreModalCustomId(interaction) {
	const m = interaction.customId.match(/^reportHeat:(1|2):score:(\d+)$/);
	if (!m) {
		return null;
	}
	return { heatNumber: /** @type {1 | 2} */ (Number(m[1])), matchId: Number(m[2]) };
}

/**
 * @param {string} label
 * @returns {string}
 */
function truncateLabel(label) {
	return label.length > 100 ? `${label.slice(0, 97)}...` : label;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {1 | 2} heatNumber
 * @returns {Promise<void>}
 */
export async function executeReportHeatCommand(interaction, heatNumber) {
	await interaction.deferReply({ ephemeral: true });

	try {
		const slug = await getHeatSlug(heatNumber);
		const matches = await listReportableMatches(slug);

		if (matches.length === 0) {
			await interaction.editReply({
				content: `No open or pending matches found for **${slug}**.`,
			});
			return;
		}

		const capped = matches.length > MAX_SELECT_OPTIONS;
		const slice = matches.slice(0, MAX_SELECT_OPTIONS);

		console.log(slice);
		const select = new StringSelectMenuBuilder()
			.setCustomId(`reportHeat:${heatNumber}:match`)
			.setPlaceholder('Select a match to report')
			.addOptions(
				slice.map((m) => ({
					label: truncateLabel(m.label),
					value: String(m.id),
					description: m.state === 'complete' ? 'Makeup' : 'Open',
				})),
			);

		const row = new ActionRowBuilder().addComponents(select);

		await interaction.editReply({
			content: `Heat: ${challongeTournamentUrl(slug)}`,
			components: [row],
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('report-heat command:', error);
		await interaction.editReply({
			content: `Could not load matches: ${message}`,
		});
	}
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @returns {Promise<void>}
 */
export async function handleReportHeatSelect(interaction) {
	const heatNumber = parseHeatFromSelectCustomId(interaction);
	if (heatNumber === null) {
		return;
	}

	const matchId = Number(interaction.values[0]);
	if (!Number.isFinite(matchId)) {
		await interaction.reply({ content: 'Invalid match selection.', ephemeral: true });
		return;
	}

	let names;
	try {
		const slug = await getHeatSlug(heatNumber);
		names = await getMatchDisplayNames(slug, matchId);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('report-heat select (names):', error);
		await interaction.reply({
			content: `Could not load match details: ${message}`,
			ephemeral: true,
		});
		return;
	}

	const modal = new ModalBuilder()
		.setCustomId(reportHeatScoreModalCustomId(heatNumber, matchId))
		.setTitle('Score Report');

	// Challonge order: player1 slot first, player2 second (matches bracket).
	const p1Input = new TextInputBuilder()
		.setCustomId('p1_score')
		.setLabel(modalGamesLabel(names.player1))
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setMaxLength(1)
		.setPlaceholder(`Rounds Won`);

	const p2Input = new TextInputBuilder()
		.setCustomId('p2_score')
		.setLabel(modalGamesLabel(names.player2))
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setMaxLength(1)
		.setPlaceholder(`Rounds Won`);

	modal.addComponents(new ActionRowBuilder().addComponents(p1Input), new ActionRowBuilder().addComponents(p2Input));

	await interaction.showModal(modal);
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @returns {Promise<void>}
 */
export async function handleReportHeatScoreModal(interaction) {
	const parsed = parseHeatScoreModalCustomId(interaction);
	if (!parsed) {
		return;
	}

	const { heatNumber, matchId } = parsed;

	const p1 = Number(interaction.fields.getTextInputValue('p1_score').trim());
	const p2 = Number(interaction.fields.getTextInputValue('p2_score').trim());

	if (p1 < 0 || p2 < 0) {
		await interaction.reply({
			content: 'Enter non-negative whole numbers for both players’ round counts.',
			ephemeral: true,
		});
		return;
	}

	try {
		const slug = await getHeatSlug(heatNumber);
		const meta = await getMatchDisplayNames(slug, matchId);
		const winnerId = resolveWinnerId(p1, p2, meta.player1Id, meta.player2Id);

		if (winnerId === null) {
			await interaction.reply({
				content: `Match needs a clear winner.`,
				ephemeral: true,
			});
			return;
		}

		await updateMatchScores(slug, matchId, `${p1}-${p2}`, winnerId);

		const reporter = interaction.user.tag;
		const url = challongeTournamentUrl(slug);
		const content = [
			'**Match Result**',
			`Heat: **${url}**`,
			`Match: **${meta.label}**`,
			`Score: **${p1}-${p2}**`,
			`Reported by: **${reporter}**`,
		].join('\n');

		await interaction.reply({ content, ephemeral: false });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('report-heat modal:', error);
		await interaction.reply({
			content: `Failed to update Challonge: ${message}`,
			ephemeral: true,
		});
	}
}
