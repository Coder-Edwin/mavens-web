import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';

/// One channel's current top game, as lichess reports it. Fields are
/// optional because we don't control the upstream shape — render
/// defensively on the client rather than trust every field is present.
export interface LichessChannelGame {
  gameId?: string;
  color?: 'white' | 'black';
  rating?: number;
  user?: { id: string; name: string; title?: string | null };
}
export type LichessTv = Record<string, LichessChannelGame>;

const GAME_ID_RE = /^[A-Za-z0-9]{8,12}$/;
const TV_CACHE_MS = 5_000;

@Injectable()
export class LichessService {
  private readonly logger = new Logger(LichessService.name);
  private tvCache: { value: LichessTv; at: number } | null = null;

  /// A snapshot of the current top game per speed/variant channel. Cached
  /// briefly so several club members polling the feed don't each hit
  /// lichess separately.
  async getTv(): Promise<LichessTv> {
    if (this.tvCache && Date.now() - this.tvCache.at < TV_CACHE_MS) {
      return this.tvCache.value;
    }
    let res: Response;
    try {
      res = await fetch('https://lichess.org/api/tv/channels');
    } catch (err) {
      this.logger.warn(`lichess tv/channels unreachable: ${(err as Error)?.message}`);
      throw new BadGatewayException('Could not reach lichess right now');
    }
    if (!res.ok) {
      throw new BadGatewayException(`lichess returned ${res.status}`);
    }
    const value = (await res.json()) as LichessTv;
    this.tvCache = { value, at: Date.now() };
    return value;
  }

  /// The PGN for one game, for "open in the analysis board". `gameId` is
  /// validated first since it's interpolated directly into the upstream URL.
  async getGamePgn(gameId: string): Promise<string> {
    if (!GAME_ID_RE.test(gameId)) {
      throw new BadRequestException('Invalid lichess game id');
    }
    let res: Response;
    try {
      res = await fetch(`https://lichess.org/game/export/${gameId}?literate=false`, {
        headers: { Accept: 'application/x-chess-pgn' }
      });
    } catch (err) {
      this.logger.warn(`lichess game export unreachable: ${(err as Error)?.message}`);
      throw new BadGatewayException('Could not reach lichess right now');
    }
    if (!res.ok) {
      throw new BadGatewayException(`lichess returned ${res.status}`);
    }
    return res.text();
  }
}
