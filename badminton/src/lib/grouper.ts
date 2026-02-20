import type { Player, Court, Round, MatchHistory } from './types';

/** Create a sorted pair key for two player IDs */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Create an empty match history */
export function createHistory(): MatchHistory {
  return { singleCounts: {}, partnerCounts: {}, opponentCounts: {} };
}

/** Record a round into the history (mutates history) */
export function recordRound(history: MatchHistory, round: Round): void {
  for (const court of [round.court1, round.court2]) {
    recordCourt(history, court);
  }
}

function recordCourt(history: MatchHistory, court: Court): void {
  // Record singles
  for (const side of [court.side1, court.side2]) {
    if (side.players.length === 1) {
      const id = side.players[0].id;
      history.singleCounts[id] = (history.singleCounts[id] || 0) + 1;
    }
    // Record partnerships (if 2 players on a side)
    if (side.players.length === 2) {
      const key = pairKey(side.players[0].id, side.players[1].id);
      history.partnerCounts[key] = (history.partnerCounts[key] || 0) + 1;
    }
  }
  // Record opponents (every player on side1 vs every player on side2)
  for (const p1 of court.side1.players) {
    for (const p2 of court.side2.players) {
      const key = pairKey(p1.id, p2.id);
      history.opponentCounts[key] = (history.opponentCounts[key] || 0) + 1;
    }
  }
}

/**
 * Get the court format for a given player count.
 * Returns [court1Side1Size, court1Side2Size, court2Side1Size, court2Side2Size]
 *
 * 4 players: 1v1 + 1v1
 * 5 players: 1v2 + 1v1
 * 6 players: 2v2 + 1v1
 * 7 players: 2v2 + 2v1
 * 8 players: 2v2 + 2v2
 */
export function getCourtFormat(playerCount: number): [number, number, number, number] {
  switch (playerCount) {
    case 4: return [1, 1, 1, 1];
    case 5: return [1, 2, 1, 1];
    case 6: return [2, 2, 1, 1];
    case 7: return [2, 2, 2, 1];
    case 8: return [2, 2, 2, 2];
    default:
      throw new Error(`Unsupported player count: ${playerCount}. Must be 4-8.`);
  }
}

/** Score a candidate round. Lower is better. */
export function scoreRound(history: MatchHistory, round: Round): number {
  let score = 0;

  // Priority 1: Minimize singles play (highest weight)
  const SINGLE_WEIGHT = 1000;
  // Priority 2: Minimize repeat partnerships
  const PARTNER_WEIGHT = 100;
  // Priority 3: Minimize repeat opponents
  const OPPONENT_WEIGHT = 10;

  for (const court of [round.court1, round.court2]) {
    for (const side of [court.side1, court.side2]) {
      if (side.players.length === 1) {
        const id = side.players[0].id;
        const count = history.singleCounts[id] || 0;
        score += count * SINGLE_WEIGHT;
      }
      if (side.players.length === 2) {
        const key = pairKey(side.players[0].id, side.players[1].id);
        const count = history.partnerCounts[key] || 0;
        score += count * PARTNER_WEIGHT;
      }
    }
    // Opponents
    for (const p1 of court.side1.players) {
      for (const p2 of court.side2.players) {
        const key = pairKey(p1.id, p2.id);
        const count = history.opponentCounts[key] || 0;
        score += count * OPPONENT_WEIGHT;
      }
    }
  }

  return score;
}

/**
 * Generate all unique ways to assign `players` into groups of specified sizes.
 * Returns arrays of groups (each group is an array of players).
 */
function* generateAssignments(
  players: Player[],
  sizes: number[],
): Generator<Player[][]> {
  if (sizes.length === 0) {
    yield [];
    return;
  }

  const [firstSize, ...restSizes] = sizes;
  const combos = combinations(players, firstSize);

  for (const combo of combos) {
    const remaining = players.filter(p => !combo.includes(p));
    for (const rest of generateAssignments(remaining, restSizes)) {
      yield [combo, ...rest];
    }
  }
}

/** Generate all combinations of k elements from arr */
function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  if (k > arr.length) return;

  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

/** Convert a flat assignment (4 groups) into a Round */
function assignmentToRound(groups: Player[][]): Round {
  return {
    court1: {
      side1: { players: groups[0] },
      side2: { players: groups[1] },
    },
    court2: {
      side1: { players: groups[2] },
      side2: { players: groups[3] },
    },
  };
}

/**
 * Generate the best next round for the given players and history.
 * Enumerates all valid groupings and picks the one with the lowest score.
 */
export function generateRound(players: Player[], history: MatchHistory): Round {
  const count = players.length;
  if (count < 4 || count > 8) {
    throw new Error(`Unsupported player count: ${count}. Must be 4-8.`);
  }

  const format = getCourtFormat(count);

  let bestRound: Round | null = null;
  let bestScore = Infinity;

  for (const assignment of generateAssignments(players, format)) {
    const round = assignmentToRound(assignment);
    const s = scoreRound(history, round);
    if (s < bestScore) {
      bestScore = s;
      bestRound = round;
      // Perfect score — can't do better
      if (s === 0) break;
    }
  }

  if (!bestRound) {
    throw new Error('Failed to generate round');
  }

  return bestRound;
}

/** Get all players in a round as a flat set of IDs */
export function roundPlayerIds(round: Round): Set<string> {
  const ids = new Set<string>();
  for (const court of [round.court1, round.court2]) {
    for (const side of [court.side1, court.side2]) {
      for (const p of side.players) {
        ids.add(p.id);
      }
    }
  }
  return ids;
}

/** Get the format label for a court */
export function courtLabel(court: Court): string {
  return `${court.side1.players.length}v${court.side2.players.length}`;
}
