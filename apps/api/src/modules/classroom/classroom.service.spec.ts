import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassroomService } from './classroom.service';
import { PrismaService } from '../../prisma/prisma.service';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('ClassroomService', () => {
  let service: ClassroomService;
  let prisma: any;

  const room = (over: Record<string, unknown> = {}) => ({
    id: 'room-1',
    code: 'ABC123',
    title: null,
    hostUserId: 'host-1',
    status: 'OPEN',
    fen: START_FEN,
    pgn: '',
    library: [],
    ...over
  });

  beforeEach(async () => {
    prisma = {
      classroomRoom: {
        create: jest.fn((a: any) => Promise.resolve(room({ ...a.data }))),
        findUnique: jest.fn(),
        update: jest.fn((a: any) => Promise.resolve(room({ ...a.data, id: a.where.id })))
      }
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClassroomService, { provide: PrismaService, useValue: prisma }]
    }).compile();
    service = module.get(ClassroomService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a room at the start position with an empty library', async () => {
      const created = await service.create('host-1', {});
      expect(created.fen).toBe(START_FEN);
      expect(created.pgn).toBe('');
      const data = prisma.classroomRoom.create.mock.calls[0][0].data;
      expect(data.hostUserId).toBe('host-1');
      expect(data.code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('retries on a code collision (P2002) rather than failing the request', async () => {
      const conflict = Object.assign(new Error('dup'), { code: 'P2002' });
      prisma.classroomRoom.create.mockRejectedValueOnce(conflict).mockImplementationOnce((a: any) =>
        Promise.resolve(room({ ...a.data }))
      );
      const created = await service.create('host-1', { title: 'Endgames' });
      expect(created.title).toBe('Endgames');
      expect(prisma.classroomRoom.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getByCode', () => {
    it('normalises the code to uppercase and rejects an unknown one', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(null);
      await expect(service.getByCode('abc123')).rejects.toThrow(NotFoundException);
      expect(prisma.classroomRoom.findUnique).toHaveBeenCalledWith({ where: { code: 'ABC123' } });
    });
  });

  describe('close', () => {
    it('refuses when the caller is not the host', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      await expect(service.close('room-1', 'someone-else')).rejects.toThrow(ForbiddenException);
    });

    it('lets the host close the room', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      const closed = await service.close('room-1', 'host-1');
      expect(prisma.classroomRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { status: 'CLOSED', closedAt: expect.any(Date) }
      });
      expect(closed).toBeDefined();
    });
  });

  describe('applyMove', () => {
    it('rejects a move once the room is closed', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room({ status: 'CLOSED' }));
      await expect(service.applyMove('room-1', { from: 'e2', to: 'e4' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an illegal move', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      await expect(service.applyMove('room-1', { from: 'e2', to: 'e5' })).rejects.toThrow(BadRequestException);
    });

    it('plays a legal move and persists the resulting fen/pgn', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      const { move } = await service.applyMove('room-1', { from: 'e2', to: 'e4' });
      expect(move.san).toBe('e4');
      const data = prisma.classroomRoom.update.mock.calls[0][0].data;
      expect(data.pgn).toContain('e4');
      expect(data.fen).not.toBe(START_FEN);
    });

    it('lets any participant continue from wherever the board currently is', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room({ pgn: '1. e4' }));
      const { move } = await service.applyMove('room-1', { from: 'e7', to: 'e5' });
      expect(move.san).toBe('e5');
    });
  });

  describe('loadPosition', () => {
    it('rejects a body with neither pgn nor fen', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      await expect(service.loadPosition('room-1', {})).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid fen', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      await expect(service.loadPosition('room-1', { fen: 'not-a-fen' })).rejects.toThrow(BadRequestException);
    });

    it('loads a fen, files it in the library, and labels it', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      const kingEnding = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';
      const { room: updated, entry } = await service.loadPosition('room-1', {
        fen: kingEnding,
        label: 'K+K ending'
      });
      expect(updated.fen).toBe(kingEnding);
      expect(entry.label).toBe('K+K ending');
      const data = prisma.classroomRoom.update.mock.calls[0][0].data;
      expect(data.library).toHaveLength(1);
    });

    it('loads a pgn and defaults the label to "Game N"', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room());
      const { entry } = await service.loadPosition('room-1', { pgn: '1. e4 e5 2. Nf3' });
      expect(entry.label).toBe('Game 1');
    });
  });

  describe('selectFromLibrary', () => {
    it('404s on an entry id that is not in the library', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room({ library: [] }));
      await expect(service.selectFromLibrary('room-1', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('sets the current position to the chosen entry', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(
        room({ library: [{ id: 'e1', label: 'Game 1', pgn: '1. e4 e5' }] })
      );
      const updated = await service.selectFromLibrary('room-1', 'e1');
      expect(updated.pgn).toBe('1. e4 e5');
    });
  });

  describe('reset', () => {
    it('restores the start position without touching the library', async () => {
      prisma.classroomRoom.findUnique.mockResolvedValue(room({ pgn: '1. e4', library: [{ id: 'e1', label: 'x', pgn: '' }] }));
      const updated = await service.reset('room-1');
      expect(updated.fen).toBe(START_FEN);
      expect(updated.pgn).toBe('');
      const data = prisma.classroomRoom.update.mock.calls[0][0].data;
      expect(data.library).toBeUndefined();
    });
  });
});
