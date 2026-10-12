import { normalizePlayerName } from './scoreParser.js';

function aliasesForMessageText(message, text) {
	const aliases = [text];
	const mentionIds = [...text.matchAll(/<@!?(\d+)>/g)].map((match) => match[1]);
	for (const id of mentionIds) {
		const user = message.mentions.users.get(id);
		const member = message.guild?.members.cache.get(id);
		if (user) aliases.push(user.username, user.globalName ?? '');
		if (member) aliases.push(member.displayName);
	}
	return aliases.map(normalizePlayerName).filter(Boolean);
}

function nameMatches(aliases, participantName) {
	const normalizedParticipant = normalizePlayerName(participantName);
	return aliases.some(
		(alias) =>
			alias === normalizedParticipant ||
			(alias.length >= 3 && (normalizedParticipant.includes(alias) || alias.includes(normalizedParticipant))),
	);
}

/**
 * Finds one open match and preserves Challonge player order for score submission.
 *
 * @param {import('discord.js').Message} message
 * @param {{ player1Text: string; player2Text: string }} parsed
 * @param {Array<{ id: number; state: string; label: string; player1: string; player2: string; player1Id: number | null; player2Id: number | null }>} matches
 * @returns {{ match: (typeof matches)[number]; reversed: boolean } | null}
 */
export function findReportedMatch(message, parsed, matches) {
	const player1Aliases = aliasesForMessageText(message, parsed.player1Text);
	const player2Aliases = aliasesForMessageText(message, parsed.player2Text);
	const found = [];

	for (const match of matches) {
		const direct = nameMatches(player1Aliases, match.player1) && nameMatches(player2Aliases, match.player2);
		const reversed = nameMatches(player1Aliases, match.player2) && nameMatches(player2Aliases, match.player1);
		if (direct || reversed) found.push({ match, reversed: !direct && reversed });
	}

	return found.length === 1 ? found[0] : null;
}
