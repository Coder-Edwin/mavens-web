import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { LichessService } from './lichess.service';

describe('LichessService', () => {
  let service: LichessService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const module: TestingModule = await Test.createTestingModule({
      providers: [LichessService]
    }).compile();
    service = module.get(LichessService);
    jest.useFakeTimers().setSystemTime(new Date('2026-09-11T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('getTv', () => {
    it('returns the parsed channel snapshot', async () => {
      const payload = { Bullet: { gameId: 'abcd1234', user: { id: 'a', name: 'A' }, rating: 2700 } };
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => payload });
      await expect(service.getTv()).resolves.toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith('https://lichess.org/api/tv/channels');
    });

    it('caches the snapshot for a few seconds', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ Bullet: {} }) });
      await service.getTv();
      await service.getTv();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(6_000);
      await service.getTv();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('raises a gateway error when lichess responds with a failure status', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503 });
      await expect(service.getTv()).rejects.toThrow(BadGatewayException);
    });

    it('raises a gateway error when the request itself fails', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      await expect(service.getTv()).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getGamePgn', () => {
    it('rejects a malformed game id without calling out', async () => {
      await expect(service.getGamePgn('../../etc/passwd')).rejects.toThrow(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetches and returns the PGN text for a valid id', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '1. e4 e5 *' });
      await expect(service.getGamePgn('abcd1234')).resolves.toBe('1. e4 e5 *');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://lichess.org/game/export/abcd1234?literate=false',
        expect.any(Object)
      );
    });

    it('raises a gateway error on a non-OK response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      await expect(service.getGamePgn('abcd1234')).rejects.toThrow(BadGatewayException);
    });
  });
});
