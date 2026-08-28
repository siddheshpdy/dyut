import { onValueWritten } from 'firebase-functions/v2/database';
import { DATABASE_REGION } from '../config.js';
import { recordAuthoritativeCompletion } from '../stats.js';
import { recordAuthoritativeEconomy } from '../economy/commands.js';

const OPTIONS = { region: DATABASE_REGION, retry: true };

export const onGameFinished = onValueWritten({ ...OPTIONS, ref: '/games/{gameId}' }, async (event) => {
  const before = event.data?.before?.val() || null;
  const game = event.data?.after?.val() || null;
  if (!game || game.serverAuthority !== true || game.status !== 'finished' || !game.winnerPlayerId || before?.status === 'finished') return null;

  const gameId = event.params.gameId;
  // Human seats retain their UID when AFK takeover or disconnect converts
  // them to a bot. They still need one authoritative completion/stat result.
  const activePlayers = Object.entries(game.playerUids || {})
    .filter(([, uid]) => uid);
  await Promise.all(activePlayers.map(([, uid]) => recordAuthoritativeCompletion({ gameId, uid, game })));
  await recordAuthoritativeEconomy({ matchId: gameId, game });
  return { gameId, participantCount: activePlayers.length };
});
