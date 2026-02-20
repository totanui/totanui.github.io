import { useState, useEffect, useCallback } from 'react';
import type { Player, Round, MatchHistory } from './lib/types';
import { generateRound, recordRound, createHistory, courtLabel } from './lib/grouper';
import { loadPlayers, savePlayers, buildShareUrl, decodePlayersFromBase64 } from './lib/storage';

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function CourtView({ court, label }: { court: Round['court1']; label: string }) {
  return (
    <div className="court">
      <div className="court-title">{label} ({courtLabel(court)})</div>
      <div className="court-matchup">
        <div className="court-side">
          {court.side1.players.map(p => (
            <span key={p.id} className="player-name">{p.name}</span>
          ))}
        </div>
        <span className="vs">vs</span>
        <div className="court-side">
          {court.side2.players.map(p => (
            <span key={p.id} className="player-name">{p.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundView({ round, index }: { round: Round; index: number }) {
  return (
    <div className="round-display">
      <div className="round-header">
        <h3>🏸 Round {index + 1}</h3>
      </div>
      <div className="courts">
        <CourtView court={round.court1} label="Court 1" />
        <CourtView court={round.court2} label="Court 2" />
      </div>
    </div>
  );
}

function App() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [activePlayers, setActivePlayers] = useState<Set<string>>(new Set());
  const [inputName, setInputName] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [history, setHistory] = useState<MatchHistory>(createHistory);
  const [toast, setToast] = useState('');

  // Load players from URL or localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('players');
    let loaded: Player[] = [];
    if (encoded) {
      loaded = decodePlayersFromBase64(encoded);
      // Clear URL params after import
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (loaded.length === 0) {
      loaded = loadPlayers();
    }
    setPlayers(loaded);
    setActivePlayers(new Set(loaded.map(p => p.id)));
  }, []);

  // Persist whenever players change
  useEffect(() => {
    savePlayers(players);
  }, [players]);

  const addPlayer = useCallback(() => {
    const name = inputName.trim();
    if (!name) return;
    const newPlayer: Player = { id: generateId(), name };
    setPlayers(prev => [...prev, newPlayer]);
    setActivePlayers(prev => new Set(prev).add(newPlayer.id));
    setInputName('');
  }, [inputName]);

  const removePlayer = useCallback((id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    setActivePlayers(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const togglePlayer = useCallback((id: string) => {
    setActivePlayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const activePlayerList = players.filter(p => activePlayers.has(p.id));
  const activeCount = activePlayerList.length;
  const canGenerate = activeCount >= 4 && activeCount <= 8;

  const handleGenerate = useCallback(() => {
    try {
      const round = generateRound(activePlayerList, history);
      const newHistory = { ...history };
      // Deep copy counts
      newHistory.singleCounts = { ...history.singleCounts };
      newHistory.partnerCounts = { ...history.partnerCounts };
      newHistory.opponentCounts = { ...history.opponentCounts };
      recordRound(newHistory, round);
      setHistory(newHistory);
      setRounds(prev => [round, ...prev]);
    } catch {
      setToast('Could not generate round');
    }
  }, [activePlayerList, history]);

  const handleReset = useCallback(() => {
    setRounds([]);
    setHistory(createHistory());
  }, []);

  const handleShare = useCallback(() => {
    const url = buildShareUrl(players);
    navigator.clipboard.writeText(url).then(
      () => showToast('Link copied to clipboard!'),
      () => showToast('Could not copy link'),
    );
  }, [players]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  return (
    <>
      <h1>🏸 Badminton Grouper</h1>
      <p className="subtitle">2 courts · 4–8 players · fair matchups</p>

      <div className="player-input">
        <input
          type="text"
          placeholder="Add player name…"
          value={inputName}
          onChange={e => setInputName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addPlayer()}
          maxLength={30}
        />
        <button className="btn btn-primary" onClick={addPlayer} disabled={!inputName.trim()}>
          Add
        </button>
      </div>

      {players.length > 0 && (
        <div className="player-list">
          {players.map(p => (
            <div
              key={p.id}
              className={`player-chip ${activePlayers.has(p.id) ? 'active' : 'inactive'}`}
              onClick={() => togglePlayer(p.id)}
            >
              <span>{p.name}</span>
              <button
                className="remove-btn"
                onClick={e => { e.stopPropagation(); removePlayer(p.id); }}
                title="Remove player"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={!canGenerate}
          title={!canGenerate ? `Select 4–8 players (${activeCount} selected)` : undefined}
        >
          🎲 Next Round
        </button>
        {rounds.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleReset}>
            Reset Session
          </button>
        )}
        {players.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleShare}>
            🔗 Share Players
          </button>
        )}
        <span className="player-count">
          {activeCount} active {activeCount === 1 ? 'player' : 'players'}
          {!canGenerate && activeCount > 0 && ' (need 4–8)'}
        </span>
      </div>

      {rounds.map((round, i) => (
        <RoundView key={rounds.length - i} round={round} index={rounds.length - 1 - i} />
      ))}

      <a href="../index.html" className="home-link">← Back to Home</a>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
