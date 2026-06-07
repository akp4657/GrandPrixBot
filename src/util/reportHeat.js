import { ActionRowBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { notifyAdminRoundComplete } from './adminNotify.js';
import {
	challongeTournamentUrl,
	fetchNormalizedMatches,
	getMatchDisplayNames,
	isRoundFullyComplete,
	listReportableMatches,
	roundForMatchId,
	updateMatchScores,
} from './challonge.js';
import { getHeatSlug, listHeats } from './heatConfig.js';

const MAX_SELECT_OPTIONS = 25;
/** Discord modal text input labels max length. */
const MODAL_LABEL_MAX = 45;

export const SCORE_REPORT_SELECT_CUSTOM_ID = 'scoreReport:match';

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
 * @param {number} heatNumber
 * @param {number} matchId
 * @returns {string}
 */
export function scoreReportModalCustomId(heatNumber, matchId) {
	return `scoreReport:${heatNumber}:score:${matchId}`;
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @returns {boolean}
 */
export function isScoreReportSelect(interaction) {
	return interaction.customId === SCORE_REPORT_SELECT_CUSTOM_ID;
}

/**
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 * @returns {{ heatNumber: number; matchId: number } | null}
 */
export function parseScoreReportModalCustomId(interaction) {
	const m = interaction.customId.match(/^scoreReport:(\d+):score:(\d+)$/);
	if (!m) {
		return null;
	}
	return { heatNumber: Number(m[1]), matchId: Number(m[2]) };
}

/**
 * @param {string} value
 * @returns {{ heatNumber: number; matchId: number } | null}
 */
function parseScoreReportSelectValue(value) {
	const m = value.match(/^(\d+):(\d+)$/);
	if (!m) {
		return null;
	}
	return { heatNumber: Number(m[1]), matchId: Number(m[2]) };
}

/**
 * @param {string} label
 * @returns {string}
 */
function truncateLabel(label) {
	return label.length > 100 ? `${label.slice(0, 97)}...` : label;
}

/**
 * @returns {Promise<Array<{ heatNumber: number; id: number; state: string; label: string }>>}
 */
async function listAllReportableMatches() {
	/** @type {Array<{ heatNumber: number; id: number; state: string; label: string }>} */
	const out = [];

	for (const { number: heatNumber, slug } of await listHeats()) {
		if (!slug) continue;

		try {
			const matches = await listReportableMatches(slug);
			for (const m of matches) {
				out.push({ heatNumber, ...m });
			}
		} catch (error) {
			console.error(`score-report load heat ${heatNumber} (${slug}):`, error);
		}
	}

	return out;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<void>}
 */
export async function executeScoreReportCommand(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	try {
		const matches = await listAllReportableMatches();

		if (matches.length === 0) {
			await interaction.editReply({
				content: 'No open or pending matches found across configured heats.',
			});
			return;
		}

		const capped = matches.length > MAX_SELECT_OPTIONS;
		const slice = matches.slice(0, MAX_SELECT_OPTIONS);

		const select = new StringSelectMenuBuilder()
			.setCustomId(SCORE_REPORT_SELECT_CUSTOM_ID)
			.setPlaceholder('Select a match to report')
			.addOptions(
				slice.map((m) => ({
					label: truncateLabel(m.label),
					value: `${m.heatNumber}:${m.id}`,
					description: `Heat ${m.heatNumber} · ${m.state === 'complete' ? 'Makeup' : 'Open'}`,
				})),
			);

		const row = new ActionRowBuilder().addComponents(select);

		const content = capped
			? `Select a match to report (showing first ${MAX_SELECT_OPTIONS} of ${matches.length}).`
			: 'Select a match to report.';

		await interaction.editReply({ content, components: [row] });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('score-report command:', error);
		await interaction.editReply({
			content: `Could not load matches: ${message}`,
		});
	}
}

/**
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 * @returns {Promise<void>}
 */
export async function handleScoreReportSelect(interaction) {
	if (!isScoreReportSelect(interaction)) {
		return;
	}

	const parsed = parseScoreReportSelectValue(interaction.values[0] ?? '');
	if (!parsed) {
		await interaction.reply({ content: 'Invalid match selection.', flags: MessageFlags.Ephemeral });
		return;
	}

	const { heatNumber, matchId } = parsed;
	const selectedOption = interaction.component.options.find((o) => o.value === interaction.values[0]);
	const matchLabel = selectedOption?.label ?? 'Player 1 vs Player 2';
	const vsSplit = matchLabel.split(/\s+vs\s+/i);
	const player1 = vsSplit[0]?.trim() || 'Player 1';
	const player2 = vsSplit[1]?.trim() || 'Player 2';

	const modal = new ModalBuilder().setCustomId(scoreReportModalCustomId(heatNumber, matchId)).setTitle('Score Report');

	// Challonge order: player1 slot first, player2 second (matches bracket).
	const p1Input = new TextInputBuilder()
		.setCustomId('p1_score')
		.setLabel(modalGamesLabel(player1))
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setMaxLength(1)
		.setPlaceholder(`Rounds Won`);

	const p2Input = new TextInputBuilder()
		.setCustomId('p2_score')
		.setLabel(modalGamesLabel(player2))
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
export async function handleScoreReportModal(interaction) {
	const parsed = parseScoreReportModalCustomId(interaction);
	if (!parsed) {
		return;
	}

	const { heatNumber, matchId } = parsed;

	const p1 = Number(interaction.fields.getTextInputValue('p1_score').trim());
	const p2 = Number(interaction.fields.getTextInputValue('p2_score').trim());

	if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 < 0 || p2 < 0) {
		await interaction.reply({
			content: 'Enter non-negative whole numbers for both players’ round counts.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply();

	try {
		const slug = await getHeatSlug(heatNumber);
		const meta = await getMatchDisplayNames(slug, matchId);
		const winnerId = resolveWinnerId(p1, p2, meta.player1Id, meta.player2Id);

		if (winnerId === null) {
			await interaction.editReply({ content: 'Match needs a clear winner.' });
			return;
		}

		const beforeMatches = await fetchNormalizedMatches(slug);
		const round = roundForMatchId(beforeMatches, matchId);
		const roundDoneBefore = isRoundFullyComplete(beforeMatches, round);

		await updateMatchScores(slug, matchId, `${p1}-${p2}`, winnerId);

		const afterMatches = await fetchNormalizedMatches(slug);
		const roundDoneAfter = isRoundFullyComplete(afterMatches, round);
		if (!roundDoneBefore && roundDoneAfter) {
			void notifyAdminRoundComplete(interaction.client, { heatNumber, slug, round }).catch((err) =>
				console.error('admin round-complete post:', err),
			);
		}

		const reporter = interaction.user.tag;
		const url = challongeTournamentUrl(slug);
		const content = [
			'**Match Result**',
			`Heat: **${url}**`,
			`Match: **${meta.label}**`,
			`Score: **${p1}-${p2}**`,
			`Reported by: **${reporter}**`,
		].join('\n');

		await interaction.editReply({ content });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('score-report modal:', error);
		await interaction.editReply({ content: `Failed to update Challonge: ${message}` });
	}
}
