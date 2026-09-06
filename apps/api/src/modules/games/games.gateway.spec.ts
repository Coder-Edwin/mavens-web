import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';

describe('GamesGateway', () => {
  let gateway: GamesGateway;
  let games: {
    get: jest.Mock;
    getForUser: jest.Mock;
    applyMove: jest.Mock;
    resign: jest.Mock;
  };
  let jwt: { verify: jest.Mock };

  const emitted: { target: string; event: string; payload: unknown }[] = [];
  const toEmit = (target: string) => ({
    emit: (event: string, payload: unknown) => emitted.push({ target, event, payload })
  });
  const server = { to: (t: string) => toEmit(t) } as never;

  const clientEmits: { event: string; payload: unknown }[] = [];
  const client = (token?: string) =>
    ({
      handshake: { auth: token ? { token } : {}, headers: {} },
      join: jest.fn(),
      emit: (event: string, payload: unknown) => clientEmits.push({ event, payload })
    }) as never;

  beforeEach(async () => {
    emitted.length = 0;
    clientEmits.length = 0;
    games = {
      get: jest.fn().mockResolvedValue({ id: 'g1', status: 'ACTIVE' }),
      getForUser: jest.fn().mockResolvedValue({ id: 'g1', status: 'ACTIVE' }),
      applyMove: jest.fn(),
      resign: jest.fn()
    };
    jwt = { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesGateway,
        { provide: GamesService, useValue: games },
        { provide: JwtService, useValue: jwt }
      ]
    }).compile();
    gateway = module.get(GamesGateway);
    gateway.server = server;
  });

  it('game:join checks access, adds the socket to the room and broadcasts current state', async () => {
    const c = client('tok');
    await gateway.onJoin(c, { gameId: 'g1' });
    expect(games.getForUser).toHaveBeenCalledWith('g1', 'user-1');
    expect((c as unknown as { join: jest.Mock }).join).toHaveBeenCalledWith('game:g1');
    expect(emitted).toContainEqual({ target: 'game:g1', event: 'game:state', payload: { id: 'g1', status: 'ACTIVE' } });
  });

  it('game:join rejects an unauthenticated socket without joining the room', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const c = client('tok');
    await gateway.onJoin(c, { gameId: 'g1' });
    expect((c as unknown as { join: jest.Mock }).join).not.toHaveBeenCalled();
    expect(clientEmits).toContainEqual({ event: 'game:error', payload: { message: 'Not authenticated' } });
  });

  it('game:join relays a forbidden access error to the sender only', async () => {
    games.getForUser.mockRejectedValue(new Error('You are not a participant in this game'));
    const c = client('tok');
    await gateway.onJoin(c, { gameId: 'g1' });
    expect((c as unknown as { join: jest.Mock }).join).not.toHaveBeenCalled();
    expect(clientEmits).toContainEqual({
      event: 'game:error',
      payload: { message: 'You are not a participant in this game' }
    });
    expect(emitted).toHaveLength(0);
  });

  it('game:move broadcasts the move and, when the game ends, a game:over', async () => {
    games.applyMove.mockResolvedValue({
      game: { fen: 'FEN', pgn: '1. e4', status: 'FINISHED', result: 'WHITE_WINS', resultReason: 'checkmate' },
      move: { san: 'e4', from: 'e2', to: 'e4', color: 'w' },
      over: { result: 'WHITE_WINS', reason: 'checkmate' }
    });

    await gateway.onMove(client('tok'), { gameId: 'g1', from: 'e2', to: 'e4' });

    expect(games.applyMove).toHaveBeenCalledWith('g1', 'user-1', { from: 'e2', to: 'e4', promotion: undefined });
    expect(emitted.map((e) => e.event)).toEqual(['game:move', 'game:over']);
  });

  it('game:move sends an error back to the sender when the service rejects', async () => {
    games.applyMove.mockRejectedValue(new Error("It's not your turn"));
    await gateway.onMove(client('tok'), { gameId: 'g1', from: 'e7', to: 'e5' });
    expect(clientEmits).toContainEqual({ event: 'game:error', payload: { message: "It's not your turn" } });
    expect(emitted).toHaveLength(0);
  });

  it('rejects a move from a socket with no valid token', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    await gateway.onMove(client('tok'), { gameId: 'g1', from: 'e2', to: 'e4' });
    expect(clientEmits).toContainEqual({ event: 'game:error', payload: { message: 'Not authenticated' } });
    expect(games.applyMove).not.toHaveBeenCalled();
  });

  it('game:resign ends the game for the room', async () => {
    games.resign.mockResolvedValue({ result: 'BLACK_WINS', resultReason: 'resignation' });
    await gateway.onResign(client('tok'), { gameId: 'g1' });
    expect(games.resign).toHaveBeenCalledWith('g1', 'user-1');
    expect(emitted.map((e) => e.event)).toEqual(['game:over', 'game:state']);
  });
});
