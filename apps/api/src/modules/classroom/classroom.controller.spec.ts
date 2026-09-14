import { Test, TestingModule } from '@nestjs/testing';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomGateway } from './classroom.gateway';

const coach = { userId: 'u1', email: 'coach@x.com', role: 'COACH', isCoach: true } as never;

describe('ClassroomController', () => {
  let controller: ClassroomController;
  let service: {
    create: jest.Mock;
    close: jest.Mock;
    loadPosition: jest.Mock;
    selectFromLibrary: jest.Mock;
    removeFromLibrary: jest.Mock;
    reset: jest.Mock;
  };
  let gateway: { broadcastState: jest.Mock; broadcastClosed: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      close: jest.fn(),
      loadPosition: jest.fn(),
      selectFromLibrary: jest.fn(),
      removeFromLibrary: jest.fn(),
      reset: jest.fn()
    };
    gateway = { broadcastState: jest.fn(), broadcastClosed: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassroomController],
      providers: [
        { provide: ClassroomService, useValue: service },
        { provide: ClassroomGateway, useValue: gateway }
      ]
    }).compile();
    controller = module.get(ClassroomController);
  });

  it('create: hands the host id from the token to the service', async () => {
    service.create.mockResolvedValue({ id: 'room-1', code: 'ABC123' });
    const result = await controller.create({ title: 'Endgames' }, coach);
    expect(service.create).toHaveBeenCalledWith('u1', { title: 'Endgames' });
    expect(result).toEqual({ id: 'room-1', code: 'ABC123' });
  });

  it('close: broadcasts the closed event after the service closes the room', async () => {
    service.close.mockResolvedValue({ id: 'room-1', status: 'CLOSED' });
    await controller.close('room-1', coach);
    expect(service.close).toHaveBeenCalledWith('room-1', 'u1');
    expect(gateway.broadcastClosed).toHaveBeenCalledWith('room-1');
  });

  it('load: broadcasts the new state and loaded entry', async () => {
    service.loadPosition.mockResolvedValue({
      room: { id: 'room-1', pgn: '1. e4' },
      entry: { id: 'e1', label: 'Game 1', pgn: '1. e4' }
    });
    const result = await controller.load('room-1', { pgn: '1. e4' });
    expect(gateway.broadcastState).toHaveBeenCalledWith(
      'room-1',
      { id: 'room-1', pgn: '1. e4' },
      { type: 'loaded', entry: { id: 'e1', label: 'Game 1', pgn: '1. e4' } }
    );
    expect(result).toEqual({ id: 'room-1', pgn: '1. e4' });
  });

  it('reset: broadcasts the reset state', async () => {
    service.reset.mockResolvedValue({ id: 'room-1', fen: 'start' });
    await controller.reset('room-1');
    expect(gateway.broadcastState).toHaveBeenCalledWith('room-1', { id: 'room-1', fen: 'start' }, { type: 'reset' });
  });
});
