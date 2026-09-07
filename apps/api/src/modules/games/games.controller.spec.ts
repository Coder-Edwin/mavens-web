import { Test, TestingModule } from '@nestjs/testing';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesGateway } from './games.gateway';

const admin = { userId: 'u1', email: 'a@x.com', role: 'ADMIN', isCoach: true } as never;

describe('GamesController', () => {
  let controller: GamesController;
  let service: { cancel: jest.Mock };
  let gateway: { broadcastState: jest.Mock };

  beforeEach(async () => {
    service = { cancel: jest.fn() };
    gateway = { broadcastState: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        { provide: GamesService, useValue: service },
        { provide: GamesGateway, useValue: gateway }
      ]
    }).compile();
    controller = module.get(GamesController);
  });

  it('cancel: after the REST cancel succeeds it broadcasts the ABANDONED state to the room', async () => {
    const abandoned = { id: 'g1', status: 'ABANDONED' };
    service.cancel.mockResolvedValue(abandoned);

    const result = await controller.cancel('g1', admin);

    expect(service.cancel).toHaveBeenCalledWith('g1', 'u1');
    expect(gateway.broadcastState).toHaveBeenCalledWith('g1', abandoned);
    expect(result).toBe(abandoned);
  });

  it('cancel: does not broadcast when the service rejects', async () => {
    service.cancel.mockRejectedValue(new Error('Only a pending challenge can be cancelled'));
    await expect(controller.cancel('g1', admin)).rejects.toThrow();
    expect(gateway.broadcastState).not.toHaveBeenCalled();
  });
});
