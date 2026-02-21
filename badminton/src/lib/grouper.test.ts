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
    expect(h.lastSingleRound).toEqual({});
    expect(h.roundsPlayed).toBe(0);
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
    // roundsPlayed should be incremented
    expect(history.roundsPlayed).toBe(1);
    // lastSingleRound should be set for all singles
    expect(history.lastSingleRound['p1']).toBe(1);
    expect(history.lastSingleRound['p2']).toBe(1);
    expect(history.lastSingleRound['p3']).toBe(1);
    expect(history.lastSingleRound['p4']).toBe(1);
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
    expect(history.roundsPlayed).toBe(2);
    // lastSingleRound should reflect the most recent round
    expect(history.lastSingleRound['p1']).toBe(2);
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
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('penalizes more recently single players higher than less recently single (FIFO tiebreaker)', () => {
    const players = makePlayers(7);
    // Both p1 and p7 have played single once, but p7 played more recently
    const history = createHistory();
    history.singleCounts['p1'] = 1;
    history.singleCounts['p7'] = 1;
    history.lastSingleRound['p1'] = 1; // played single in round 1 (long ago)
    history.lastSingleRound['p7'] = 7; // played single in round 7 (just now)
    history.roundsPlayed = 7;

    // Build two rounds that are identical except for which player is the single
    const makeRoundWithSingle = (singlePlayer: (typeof players)[0]) => {
      const rest = players.filter(p => p !== singlePlayer);
      return {
        court1: {
          side1: { players: [rest[0], rest[1]] },
          side2: { players: [rest[2], rest[3]] },
        },
        court2: {
          side1: { players: [rest[4], rest[5]] },
          side2: { players: [singlePlayer] },
        },
      };
    };

    const scoreP1Single = scoreRound(history, makeRoundWithSingle(players[0]));
    const scoreP7Single = scoreRound(history, makeRoundWithSingle(players[6]));

    // p7 was single most recently so penalised more → algorithm prefers p1
    expect(scoreP1Single).toBeLessThan(scoreP7Single);
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

    it('respects FIFO single order for 7 players: player who played single in round 1 has lower score than round-7 player in round 8', () => {
      const players = makePlayers(7);

      // Use a controlled history with no partner/opponent counts so that only the
      // FIFO recency weight affects the score difference between candidate rounds.
      // Simulating 7 rounds where each player was single exactly once, in order.
      const history = createHistory();
      history.roundsPlayed = 7;
      for (let i = 0; i < players.length; i++) {
        history.singleCounts[players[i].id] = 1;
        history.lastSingleRound[players[i].id] = i + 1; // rounds 1–7
      }

      // p1 was single in round 1 (least recently), p7 was single in round 7 (most recently)
      const roundOneSingle = players[0].id;
      const roundSevenSingle = players[6].id;

      // Both have count=1; the recency weight makes round-7's single costlier
      const histSingle1 = history.lastSingleRound[roundOneSingle];
      const histSingle7 = history.lastSingleRound[roundSevenSingle];
      expect(histSingle7).toBeGreaterThan(histSingle1);

      // Verify the scoring function reflects this: the round-7 single player has a
      // higher penalty (less preferred) than the round-1 single player.
      // The same 5 non-single players occupy the same positions in both candidate
      // rounds; only the identity of the single player differs, so any
      // partner/opponent penalties cancel out exactly.
      const corePlayers = players.filter(p => p.id !== roundOneSingle && p.id !== roundSevenSingle);
      const makeRoundWithSingle = (singleId: string) => {
        const singlePlayer = players.find(p => p.id === singleId)!;
        const courtPartner = singleId === roundOneSingle ? players[6] : players[0];
        return {
          court1: {
            side1: { players: [corePlayers[0], corePlayers[1]] },
            side2: { players: [corePlayers[2], corePlayers[3]] },
          },
          court2: {
            side1: { players: [corePlayers[4], courtPartner] },
            side2: { players: [singlePlayer] },
          },
        };
      };

      const scoreRound1Single = scoreRound(history, makeRoundWithSingle(roundOneSingle));
      const scoreRound7Single = scoreRound(history, makeRoundWithSingle(roundSevenSingle));
      expect(scoreRound1Single).toBeLessThan(scoreRound7Single);
    });

    it('no partner repeats for 8 players over 7 rounds (full pair coverage)', () => {
      // 8 players have C(8,2)=28 unique pairs, with 4 pairs per round.
      // 7 rounds should cover all 28 pairs without any repeat.
      const players = makePlayers(8);
      const history = createHistory();

      const allPartnerPairs = new Set<string>();
      let repeatFound = false;

      for (let i = 0; i < 7; i++) {
        const round = generateRound(players, history);
        for (const pair of getPartnerPairs(round)) {
          if (allPartnerPairs.has(pair)) repeatFound = true;
          allPartnerPairs.add(pair);
        }
        recordRound(history, round);
      }

      expect(repeatFound).toBe(false);
      expect(allPartnerPairs.size).toBe(28);
    });

    it('partner avoidance takes priority over opponent avoidance', () => {
      // Construct a history where all partner pairs are used once except 4,
      // and all non-partner opponent pairs have high counts.
      // The algorithm should still prefer the unused partner pairs.
      const players = makePlayers(8);
      const history = createHistory();
      history.roundsPlayed = 20;

      const unusedPartners = new Set([
        pairKey('p1', 'p2'),
        pairKey('p3', 'p4'),
        pairKey('p5', 'p6'),
        pairKey('p7', 'p8'),
      ]);

      for (let i = 0; i < 8; i++) {
        for (let j = i + 1; j < 8; j++) {
          const key = pairKey(`p${i + 1}`, `p${j + 1}`);
          if (!unusedPartners.has(key)) {
            history.partnerCounts[key] = 1;
            history.opponentCounts[key] = 15;
          }
        }
      }

      const round = generateRound(players, history);
      const pairs = getPartnerPairs(round);

      // All 4 generated pairs should be from the unused set
      for (const pair of pairs) {
        expect(unusedPartners.has(pair)).toBe(true);
      }
    });

    it('recycles partner groupings: round 8 with 8 players reuses round-1 partner pairs (FIFO)', () => {
      // With 8 players and 4 partner pairs per round, all 28 unique pairs are
      // covered in exactly 7 rounds. Round 8 starts a new cycle and should
      // prefer the pairs that were used least recently (i.e. round 1's pairs).
      const players = makePlayers(8);
      const history = createHistory();

      // Record 7 rounds to exhaust all unique pairs
      const roundPairs: string[][] = [];
      for (let i = 0; i < 7; i++) {
        const round = generateRound(players, history);
        roundPairs.push(getPartnerPairs(round));
        recordRound(history, round);
      }

      // All 28 pairs used once; round 1's pairs have the lowest lastPartnerRound
      const round1Pairs = new Set(roundPairs[0]);
      const round8 = generateRound(players, history);
      const round8Pairs = getPartnerPairs(round8);

      // Round 8 should reuse exactly the same partner pairs as round 1
      expect(new Set(round8Pairs)).toEqual(round1Pairs);
    });

    it('distributes singles fairly with 7 players over 14 rounds (two full cycles)', () => {
      const players = makePlayers(7);
      const history = createHistory();

      for (let i = 0; i < 14; i++) {
        const round = generateRound(players, history);
        recordRound(history, round);
      }

      // After 14 rounds with 1 single per round, each player should have played
      // single exactly twice in a perfect scenario
      const counts = Object.values(history.singleCounts);
      const maxSingles = Math.max(...counts);
      const minSingles = Math.min(...counts);
      // Allow at most 1 difference across two full cycles
      expect(maxSingles - minSingles).toBeLessThanOrEqual(1);
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
