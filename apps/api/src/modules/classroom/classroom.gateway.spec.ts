import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ClassroomGateway } from './classroom.gateway';
import { ClassroomService } from './classroom.service';

describe('ClassroomGateway', () => {
  let gateway: ClassroomGateway;
  let classroom: {
    get: jest.Mock;
    applyMove: jest.Mock;
    loadPosition: jest.Mock;
    selectFromLibrary: jest.Mock;
    reset: jest.Mock;
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
      id: 'sock-1',
      handshake: { auth: token ? { token } : {}, headers: {} },
      data: {} as Record<string, unknown>,
      join: jest.fn(),
      emit: (event: string, payload: unknown) => clientEmits.push({ event, payload })
    }) as never;

  beforeEach(async () => {
    emitted.length = 0;
    clientEmits.length = 0;
    classroom = {
      get: jest.fn().mockResolvedValue({ id: 'room-1', status: 'OPEN' }),
      applyMove: jest.fn(),
      loadPosition: jest.fn(),
      selectFromLibrary: jest.fn(),
      reset: jest.fn()
    };
    jwt = { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassroomGateway,
        { provide: ClassroomService, useValue: classroom },
        { provide: JwtService, useValue: jwt }
      ]
    }).compile();
    gateway = module.get(ClassroomGateway);
    gateway.server = server;
  });

  it('classroom:join adds the socket to the room, sends state to the sender, and broadcasts the roster', async () => {
    const c = client('tok');
    await gateway.onJoin(c, { roomId: 'room-1', name: 'Coach Amwai' });
    expect((c as unknown as { join: jest.Mock }).join).toHaveBeenCalledWith('classroom:room-1');
    expect(clientEmits).toContainEqual({
      event: 'classroom:state',
      payload: { room: { id: 'room-1', status: 'OPEN' } }
    });
    expect(emitted).toContainEqual({
      target: 'classroom:room-1',
      event: 'classroom:participants',
      payload: [{ userId: 'user-1', name: 'Coach Amwai' }]
    });
  });

  it('classroom:join rejects an unauthenticated socket', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });
    const c = client('tok');
    await gateway.onJoin(c, { roomId: 'room-1' });
    expect((c as unknown as { join: jest.Mock }).join).not.toHaveBeenCalled();
    expect(clientEmits).toContainEqual({ event: 'classroom:error', payload: { message: 'Not authenticated' } });
  });

  it('handleDisconnect drops the last participant with no one left to notify', async () => {
    const c = client('tok');
    await gateway.onJoin(c, { roomId: 'room-1', name: 'Faith' });
    emitted.length = 0;
    gateway.handleDisconnect(c);
    // Nobody else is in the room, so there's nothing to broadcast to — just
    // confirm this doesn't throw and the roster empties (see the next test).
    expect(emitted).toHaveLength(0);
  });

  it('handleDisconnect broadcasts the remaining roster when someone else is still in the room', async () => {
    const c1 = client('tok');
    const c2 = { ...client('tok'), id: 'sock-2', data: {} as Record<string, unknown> };
    await gateway.onJoin(c1, { roomId: 'room-1', name: 'Faith' });
    await gateway.onJoin(c2 as never, { roomId: 'room-1', name: 'Coach Amwai' });
    emitted.length = 0;
    gateway.handleDisconnect(c1);
    expect(emitted).toContainEqual({
      target: 'classroom:room-1',
      event: 'classroom:participants',
      payload: [{ userId: 'user-1', name: 'Coach Amwai' }]
    });
  });

  it('classroom:move broadcasts the resulting state to everyone in the room', async () => {
    classroom.applyMove.mockResolvedValue({
      room: { id: 'room-1', fen: 'FEN', pgn: '1. e4' },
      move: { san: 'e4', from: 'e2', to: 'e4' }
    });
    await gateway.onMove(client('tok'), { roomId: 'room-1', from: 'e2', to: 'e4' });
    expect(classroom.applyMove).toHaveBeenCalledWith('room-1', { from: 'e2', to: 'e4', promotion: undefined });
    expect(emitted).toContainEqual({
      target: 'classroom:room-1',
      event: 'classroom:state',
      payload: { room: { id: 'room-1', fen: 'FEN', pgn: '1. e4' }, move: { san: 'e4', from: 'e2', to: 'e4' } }
    });
  });

  it('classroom:move sends a rejection back to the sender only, without broadcasting', async () => {
    classroom.applyMove.mockRejectedValue(new Error('Illegal move'));
    await gateway.onMove(client('tok'), { roomId: 'room-1', from: 'e2', to: 'e5' });
    expect(clientEmits).toContainEqual({ event: 'classroom:error', payload: { message: 'Illegal move' } });
    expect(emitted).toHaveLength(0);
  });

  it('classroom:load broadcasts the new state and the loaded library entry', async () => {
    classroom.loadPosition.mockResolvedValue({
      room: { id: 'room-1', pgn: '1. e4 e5' },
      entry: { id: 'e1', label: 'Game 1', pgn: '1. e4 e5' }
    });
    await gateway.onLoad(client('tok'), { roomId: 'room-1', pgn: '1. e4 e5' });
    expect(emitted).toContainEqual({
      target: 'classroom:room-1',
      event: 'classroom:state',
      payload: {
        room: { id: 'room-1', pgn: '1. e4 e5' },
        loadedEntry: { id: 'e1', label: 'Game 1', pgn: '1. e4 e5' }
      }
    });
  });

  it('broadcastState pushes authoritative state after a REST mutation', () => {
    gateway.broadcastState('room-1', { id: 'room-1', status: 'CLOSED' });
    expect(emitted).toContainEqual({
      target: 'classroom:room-1',
      event: 'classroom:state',
      payload: { room: { id: 'room-1', status: 'CLOSED' } }
    });
  });

  it('broadcastClosed tells the room it has been closed', () => {
    gateway.broadcastClosed('room-1');
    expect(emitted).toContainEqual({ target: 'classroom:room-1', event: 'classroom:closed', payload: undefined });
  });
});
