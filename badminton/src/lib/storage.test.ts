import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPlayers,
  savePlayers,
  encodePlayersToBase64,
  decodePlayersFromBase64,
} from './storage';
import type { Player } from './types';

beforeEach(() => {
  localStorage.clear();
});

describe('savePlayers / loadPlayers', () => {
  it('persists and retrieves players', () => {
    const players: Player[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    savePlayers(players);
    expect(loadPlayers()).toEqual(players);
  });

  it('returns empty array when nothing stored', () => {
    expect(loadPlayers()).toEqual([]);
  });

  it('returns empty array on corrupted data', () => {
    localStorage.setItem('badminton-players', '{bad json');
    expect(loadPlayers()).toEqual([]);
  });
});

describe('encodePlayersToBase64 / decodePlayersFromBase64', () => {
  it('round-trips player data', () => {
    const players: Player[] = [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
    ];
    const encoded = encodePlayersToBase64(players);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    expect(decodePlayersFromBase64(encoded)).toEqual(players);
  });

  it('returns empty array for invalid base64', () => {
    expect(decodePlayersFromBase64('!!!invalid!!!')).toEqual([]);
  });

  it('returns empty array for valid base64 but non-array JSON', () => {
    const encoded = btoa('{"not": "array"}');
    expect(decodePlayersFromBase64(encoded)).toEqual([]);
  });

  it('filters out invalid player objects', () => {
    const encoded = btoa(JSON.stringify([
      { id: 'a', name: 'Alice' },
      { id: 123, name: 'Bad' },
      { name: 'NoId' },
      null,
    ]));
    const result = decodePlayersFromBase64(encoded);
    expect(result).toEqual([{ id: 'a', name: 'Alice' }]);
  });
});
