import { api } from './api-client';

export interface LichessChannelGame {
  gameId?: string;
  color?: 'white' | 'black';
  rating?: number;
  user?: { id: string; name: string; title?: string | null };
}
export type LichessTv = Record<string, LichessChannelGame>;

// Preferred display order; anything else lichess adds later still shows,
// just after these.
export const CHANNEL_ORDER = [
  'Bullet',
  'Blitz',
  'Rapid',
  'Classical',
  'UltraBullet',
  'Chess960',
  'Crazyhouse',
  'Atomic',
  'Horde',
  'Antichess',
  'KingOfTheHill',
  'RacingKings',
  'ThreeCheck'
];

export function sortedChannels(tv: LichessTv): [string, LichessChannelGame][] {
  return Object.entries(tv)
    .filter(([, game]) => !!game?.gameId)
    .sort(([a], [b]) => {
      const ia = CHANNEL_ORDER.indexOf(a);
      const ib = CHANNEL_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

export const lichessApi = {
  tv: () => api.get<LichessTv>('/lichess/tv'),
  gamePgn: (id: string) => api.get<{ pgn: string }>(`/lichess/game/${id}/pgn`)
};
