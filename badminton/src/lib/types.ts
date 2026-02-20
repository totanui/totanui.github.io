export interface Player {
  id: string;
  name: string;
}

/** A side of a court: 1 or 2 players */
export interface CourtSide {
  players: Player[];
}

/** A single court with two sides */
export interface Court {
  side1: CourtSide;
  side2: CourtSide;
}

/** A full round across both courts */
export interface Round {
  court1: Court;
  court2: Court;
}

/** Tracks history for diversity scoring */
export interface MatchHistory {
  /** Map of "playerId" -> count of times played as single (alone on a side) */
  singleCounts: Record<string, number>;
  /** Map of "id1-id2" (sorted) -> count of times partnered together */
  partnerCounts: Record<string, number>;
  /** Map of "id1-id2" (sorted) -> count of times faced as opponents */
  opponentCounts: Record<string, number>;
}
