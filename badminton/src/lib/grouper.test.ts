import { describe, it, expect } from 'vitest';
import {
  pairKey,
  createHistory,
  recordRound,
  getCourtFormat,
  scoreRound,
  generateRound,
  roundPlayerIds,
  courtLabel,
} from './grouper';
import type { Player, Round } from './types';

// Helper to create players with sequential IDs
function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
  }));
}

// Helper to count singles in a round
function countSingles(round: Round): number {
  let count = 0;
  for (const court of [round.court1, round.court2]) {
    for (const side of [court.side1, court.side2]) {
      if (side.players.length === 1) count++;
    }
  }
  return count;
}

// Helper to get all partner pairs from a round
function getPartnerPairs(round: Round): string[] {
  const pairs: string[] = [];
  for (const court of [round.court1, round.court2]) {
    for (const side of [court.side1, court.side2]) {
      if (side.players.length === 2) {
        pairs.push(pairKey(side.players[0].id, side.players[1].id));
      }
    }
  }
  return pairs;
}

// Helper to get all opponent pairs from a round
function getOpponentPairs(round: Round): string[] {
  const pairs: string[] = [];
  for (const court of [round.court1, round.court2]) {
    for (const p1 of court.side1.players) {
      for (const p2 of court.side2.players) {
        pairs.push(pairKey(p1.id, p2.id));
      }
    }
  }
  return pairs;
}

describe('pairKey', () => {
  it('produces consistent sorted keys', () => {
    expect(pairKey('a', 'b')).toBe('a-b');
    expect(pairKey('b', 'a')).toBe('a-b');
  });

  it('handles same-id pairs', () => {
    expect(pairKey('x', 'x')).toBe('x-x');
  });
});

describe('createHistory', () => {
  it('creates empty history', () => {
    const h = createHistory();
    expect(h.singleCounts).toEqual({});
    expect(h.partnerCounts).toEqual({});
    expect(h.opponentCounts).toEqual({});
  });
});

describe('getCourtFormat', () => {
  it('returns [1,1,1,1] for 4 players', () => {
    expect(getCourtFormat(4)).toEqual([1, 1, 1, 1]);
  });

  it('returns [1,2,1,1] for 5 players', () => {
    expect(getCourtFormat(5)).toEqual([1, 2, 1, 1]);
  });

  it('returns [2,2,1,1] for 6 players', () => {
    expect(getCourtFormat(6)).toEqual([2, 2, 1, 1]);
  });

  it('returns [2,2,2,1] for 7 players', () => {
    expect(getCourtFormat(7)).toEqual([2, 2, 2, 1]);
  });

  it('returns [2,2,2,2] for 8 players', () => {
    expect(getCourtFormat(8)).toEqual([2, 2, 2, 2]);
  });

  it('throws for unsupported counts', () => {
    expect(() => getCourtFormat(3)).toThrow('Unsupported player count');
    expect(() => getCourtFormat(9)).toThrow('Unsupported player count');
    expect(() => getCourtFormat(0)).toThrow('Unsupported player count');
  });
});

describe('recordRound', () => {
  it('records singles correctly', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    recordRound(history, round);

    expect(history.singleCounts['p1']).toBe(1);
    expect(history.singleCounts['p2']).toBe(1);
    expect(history.singleCounts['p3']).toBe(1);
    expect(history.singleCounts['p4']).toBe(1);
  });

  it('records partnerships correctly for 2v2', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0], players[1]] },
        side2: { players: [players[2], players[3]] },
      },
      court2: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
    };
    const history = createHistory();
    recordRound(history, round);

    expect(history.partnerCounts[pairKey('p1', 'p2')]).toBe(1);
    expect(history.partnerCounts[pairKey('p3', 'p4')]).toBe(1);
  });

  it('records opponents correctly', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    recordRound(history, round);

    expect(history.opponentCounts[pairKey('p1', 'p2')]).toBe(1);
    expect(history.opponentCounts[pairKey('p3', 'p4')]).toBe(1);
    // Non-opponents should not be recorded
    expect(history.opponentCounts[pairKey('p1', 'p3')]).toBeUndefined();
  });

  it('accumulates counts across multiple rounds', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    recordRound(history, round);
    recordRound(history, round);

    expect(history.singleCounts['p1']).toBe(2);
    expect(history.opponentCounts[pairKey('p1', 'p2')]).toBe(2);
  });
});

describe('scoreRound', () => {
  it('returns 0 for empty history', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    expect(scoreRound(history, round)).toBe(0);
  });

  it('penalizes repeated singles heavily', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    // Player 1 has played single before
    history.singleCounts['p1'] = 1;

    const score = scoreRound(history, round);
    // Should include a 1000-point penalty for p1 singles
    expect(score).toBeGreaterThanOrEqual(1000);
  });

  it('penalizes repeated partnerships', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0], players[1]] },
        side2: { players: [players[2], players[3]] },
      },
      court2: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
    };
    const history = createHistory();
    history.partnerCounts[pairKey('p1', 'p2')] = 1;

    const score = scoreRound(history, round);
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it('penalizes repeated opponents', () => {
    const players = makePlayers(4);
    const round: Round = {
      court1: {
        side1: { players: [players[0]] },
        side2: { players: [players[1]] },
      },
      court2: {
        side1: { players: [players[2]] },
        side2: { players: [players[3]] },
      },
    };
    const history = createHistory();
    history.opponentCounts[pairKey('p1', 'p2')] = 1;

    const score = scoreRound(history, round);
    expect(score).toBeGreaterThanOrEqual(10);
  });

  it('singles penalty > partner penalty > opponent penalty', () => {
    const players = makePlayers(6);

    // Round with a single
    const roundWithSingle: Round = {
      court1: {
        side1: { players: [players[0], players[1]] },
        side2: { players: [players[2], players[3]] },
      },
      court2: {
        side1: { players: [players[4]] },
        side2: { players: [players[5]] },
      },
    };

    const histSingle = createHistory();
    histSingle.singleCounts['p5'] = 1;
    const singleScore = scoreRound(histSingle, roundWithSingle);

    // Round with repeated partner
    const roundWithPartner: Round = {
      court1: {
        side1: { players: [players[0], players[1]] },
        side2: { players: [players[2], players[3]] },
      },
      court2: {
        side1: { players: [players[4]] },
        side2: { players: [players[5]] },
      },
    };
    const histPartner = createHistory();
    histPartner.partnerCounts[pairKey('p1', 'p2')] = 1;
    const partnerScore = scoreRound(histPartner, roundWithPartner);

    // Round with repeated opponent
    const histOpponent = createHistory();
    histOpponent.opponentCounts[pairKey('p1', 'p3')] = 1;
    const opponentScore = scoreRound(histOpponent, roundWithPartner);

    expect(singleScore).toBeGreaterThan(partnerScore);
    expect(partnerScore).toBeGreaterThan(opponentScore);
  });
});

describe('generateRound', () => {
  describe('player count validation', () => {
    it('throws for fewer than 4 players', () => {
      expect(() => generateRound(makePlayers(3), createHistory())).toThrow();
    });

    it('throws for more than 8 players', () => {
      expect(() => generateRound(makePlayers(9), createHistory())).toThrow();
    });
  });

  describe('4 players: 1v1 + 1v1', () => {
    it('assigns all 4 players across 2 courts', () => {
      const players = makePlayers(4);
      const round = generateRound(players, createHistory());
      const ids = roundPlayerIds(round);
      expect(ids.size).toBe(4);
      players.forEach(p => expect(ids.has(p.id)).toBe(true));
    });

    it('has correct format: 1v1 + 1v1', () => {
      const round = generateRound(makePlayers(4), createHistory());
      expect(courtLabel(round.court1)).toBe('1v1');
      expect(courtLabel(round.court2)).toBe('1v1');
    });

    it('all players play as singles', () => {
      const round = generateRound(makePlayers(4), createHistory());
      expect(countSingles(round)).toBe(4);
    });
  });

  describe('5 players: 1v2 + 1v1', () => {
    it('assigns all 5 players', () => {
      const players = makePlayers(5);
      const round = generateRound(players, createHistory());
      const ids = roundPlayerIds(round);
      expect(ids.size).toBe(5);
    });

    it('has correct format: 1v2 + 1v1', () => {
      const round = generateRound(makePlayers(5), createHistory());
      expect(courtLabel(round.court1)).toBe('1v2');
      expect(courtLabel(round.court2)).toBe('1v1');
    });

    it('has exactly 3 singles and 1 doubles pair', () => {
      const round = generateRound(makePlayers(5), createHistory());
      expect(countSingles(round)).toBe(3);
      expect(getPartnerPairs(round).length).toBe(1);
    });
  });

  describe('6 players: 2v2 + 1v1', () => {
    it('assigns all 6 players', () => {
      const players = makePlayers(6);
      const round = generateRound(players, createHistory());
      const ids = roundPlayerIds(round);
      expect(ids.size).toBe(6);
    });

    it('has correct format: 2v2 + 1v1', () => {
      const round = generateRound(makePlayers(6), createHistory());
      expect(courtLabel(round.court1)).toBe('2v2');
      expect(courtLabel(round.court2)).toBe('1v1');
    });

    it('has exactly 2 singles and 2 doubles pairs', () => {
      const round = generateRound(makePlayers(6), createHistory());
      expect(countSingles(round)).toBe(2);
      expect(getPartnerPairs(round).length).toBe(2);
    });
  });

  describe('7 players: 2v2 + 2v1', () => {
    it('assigns all 7 players', () => {
      const players = makePlayers(7);
      const round = generateRound(players, createHistory());
      const ids = roundPlayerIds(round);
      expect(ids.size).toBe(7);
    });

    it('has correct format: 2v2 + 2v1', () => {
      const round = generateRound(makePlayers(7), createHistory());
      expect(courtLabel(round.court1)).toBe('2v2');
      expect(courtLabel(round.court2)).toBe('2v1');
    });

    it('has exactly 1 single and 3 doubles pairs', () => {
      const round = generateRound(makePlayers(7), createHistory());
      expect(countSingles(round)).toBe(1);
      expect(getPartnerPairs(round).length).toBe(3);
    });
  });

  describe('8 players: 2v2 + 2v2', () => {
    it('assigns all 8 players', () => {
      const players = makePlayers(8);
      const round = generateRound(players, createHistory());
      const ids = roundPlayerIds(round);
      expect(ids.size).toBe(8);
    });

    it('has correct format: 2v2 + 2v2', () => {
      const round = generateRound(makePlayers(8), createHistory());
      expect(courtLabel(round.court1)).toBe('2v2');
      expect(courtLabel(round.court2)).toBe('2v2');
    });

    it('has zero singles and 4 doubles pairs', () => {
      const round = generateRound(makePlayers(8), createHistory());
      expect(countSingles(round)).toBe(0);
      expect(getPartnerPairs(round).length).toBe(4);
    });
  });

  describe('diversity optimization', () => {
    it('avoids repeating the same singles player (6 players)', () => {
      const players = makePlayers(6);
      const history = createHistory();

      // Play 3 rounds and check that singles rotate
      const singlesPlayers = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const round = generateRound(players, history);
        for (const court of [round.court1, round.court2]) {
          for (const side of [court.side1, court.side2]) {
            if (side.players.length === 1) {
              singlesPlayers.add(side.players[0].id);
            }
          }
        }
        recordRound(history, round);
      }

      // After 3 rounds, at least 3 different players should have played singles
      // (since we have 6 players and 2 singles per round, with diversity optimization)
      expect(singlesPlayers.size).toBeGreaterThanOrEqual(3);
    });

    it('avoids repeating the same partnerships (8 players)', () => {
      const players = makePlayers(8);
      const history = createHistory();

      const partnerSets: string[][] = [];
      for (let i = 0; i < 3; i++) {
        const round = generateRound(players, history);
        partnerSets.push(getPartnerPairs(round));
        recordRound(history, round);
      }

      // In 3 rounds of 8 players (4 pairs per round = 12 total pairs),
      // with 28 possible pairs, we should have good diversity
      const allPairs = partnerSets.flat();
      const uniquePairs = new Set(allPairs);
      expect(uniquePairs.size).toBeGreaterThanOrEqual(6);
    });

    it('avoids repeating opponents (4 players over 3 rounds)', () => {
      const players = makePlayers(4);
      const history = createHistory();

      const opponentSets: string[][] = [];
      for (let i = 0; i < 3; i++) {
        const round = generateRound(players, history);
        opponentSets.push(getOpponentPairs(round));
        recordRound(history, round);
      }

      // With 4 players (6 possible pairs), over 3 rounds (2 opponent pairs per round),
      // we should see at least 4 different opponent matchups
      const allPairs = opponentSets.flat();
      const uniquePairs = new Set(allPairs);
      expect(uniquePairs.size).toBeGreaterThanOrEqual(4);
    });

    it('distributes singles fairly with 7 players over many rounds', () => {
      const players = makePlayers(7);
      const history = createHistory();

      for (let i = 0; i < 7; i++) {
        const round = generateRound(players, history);
        recordRound(history, round);
      }

      // After 7 rounds with 1 single per round, each player should have
      // played single exactly once in a perfect scenario
      const counts = Object.values(history.singleCounts);
      const maxSingles = Math.max(...counts);
      const minSingles = Math.min(...counts);
      // Allow at most 1 difference
      expect(maxSingles - minSingles).toBeLessThanOrEqual(1);
    });

    it('generates different groupings on consecutive rounds', () => {
      const players = makePlayers(6);
      const history = createHistory();

      const round1 = generateRound(players, history);
      recordRound(history, round1);
      const round2 = generateRound(players, history);

      // The two rounds should not be identical
      const ids1 = [
        round1.court1.side1.players.map(p => p.id).sort().join(','),
        round1.court1.side2.players.map(p => p.id).sort().join(','),
        round1.court2.side1.players.map(p => p.id).sort().join(','),
        round1.court2.side2.players.map(p => p.id).sort().join(','),
      ].sort().join('|');

      const ids2 = [
        round2.court1.side1.players.map(p => p.id).sort().join(','),
        round2.court1.side2.players.map(p => p.id).sort().join(','),
        round2.court2.side1.players.map(p => p.id).sort().join(','),
        round2.court2.side2.players.map(p => p.id).sort().join(','),
      ].sort().join('|');

      expect(ids1).not.toBe(ids2);
    });

    it('first round always scores 0 (no history)', () => {
      for (let count = 4; count <= 8; count++) {
        const players = makePlayers(count);
        const history = createHistory();
        const round = generateRound(players, history);
        expect(scoreRound(history, round)).toBe(0);
      }
    });

    it('first round is not always the same grouping (shuffle)', () => {
      const players = makePlayers(6);
      const seen = new Set<string>();

      for (let trial = 0; trial < 20; trial++) {
        const round = generateRound(players, createHistory());
        const key = [
          round.court1.side1.players.map(p => p.id).sort().join(','),
          round.court1.side2.players.map(p => p.id).sort().join(','),
          round.court2.side1.players.map(p => p.id).sort().join(','),
          round.court2.side2.players.map(p => p.id).sort().join(','),
        ].sort().join('|');
        seen.add(key);
      }

      // With shuffling, 20 trials on 6 players should produce multiple distinct groupings
      expect(seen.size).toBeGreaterThan(1);
    });
  });
});

describe('roundPlayerIds', () => {
  it('returns all unique player IDs in a round', () => {
    const players = makePlayers(6);
    const round: Round = {
      court1: {
        side1: { players: [players[0], players[1]] },
        side2: { players: [players[2], players[3]] },
      },
      court2: {
        side1: { players: [players[4]] },
        side2: { players: [players[5]] },
      },
    };
    const ids = roundPlayerIds(round);
    expect(ids.size).toBe(6);
    expect(ids).toContain('p1');
    expect(ids).toContain('p6');
  });
});

describe('courtLabel', () => {
  it('returns correct format string', () => {
    const players = makePlayers(4);
    expect(courtLabel({
      side1: { players: [players[0]] },
      side2: { players: [players[1]] },
    })).toBe('1v1');

    expect(courtLabel({
      side1: { players: [players[0], players[1]] },
      side2: { players: [players[2], players[3]] },
    })).toBe('2v2');

    expect(courtLabel({
      side1: { players: [players[0], players[1]] },
      side2: { players: [players[2]] },
    })).toBe('2v1');

    expect(courtLabel({
      side1: { players: [players[0]] },
      side2: { players: [players[1], players[2]] },
    })).toBe('1v2');
  });
});
