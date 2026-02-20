import type { Player } from './types';

const STORAGE_KEY = 'badminton-players';

export function loadPlayers(): Player[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as Player[];
  } catch {
    return [];
  }
}

export function savePlayers(players: Player[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

export function encodePlayersToBase64(players: Player[]): string {
  const json = JSON.stringify(players.map(p => ({ id: p.id, name: p.name })));
  return btoa(json);
}

export function decodePlayersFromBase64(encoded: string): Player[] {
  try {
    const json = atob(encoded);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: unknown): p is Player =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Player).id === 'string' &&
        typeof (p as Player).name === 'string',
    );
  } catch {
    return [];
  }
}

export function buildShareUrl(players: Player[]): string {
  const encoded = encodePlayersToBase64(players);
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('players', encoded);
  return url.toString();
}
