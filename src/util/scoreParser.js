/**
 * @typedef {{ player1Text: string; player2Text: string; player1Score: number; player2Score: number }} ParsedScore
 */

/**
 * Finds a score anywhere in a message, allowing channel names, bot mentions,
 * and other surrounding text.
 *
 * @param {string} content
 * @returns {ParsedScore | null}
 */
export function parseScoreMessage(content) {
	const match = content.match(/(\d+)\s*-\s*(\d+)/);
	if (!match) return null;

	const player1Score = Number(match[1]);
	const player2Score = Number(match[2]);
	if (!Number.isInteger(player1Score) || !Number.isInteger(player2Score)) return null;
	if (player1Score < 0 || player2Score < 0 || player1Score === player2Score) return null;

	const scoreStart = match.index ?? 0;
	const scoreEnd = scoreStart + match[0].length;
	return {
		player1Text: content.slice(0, scoreStart).trim(),
		player2Text: content.slice(scoreEnd).trim(),
		player1Score,
		player2Score,
	};
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizePlayerName(value) {
	return value
		.replace(/<@!?\d+>/g, '')
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}
