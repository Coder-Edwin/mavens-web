import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

// bcrypt is a native addon imported as `import * as bcrypt`. Under the SWC
// wildcard interop the service and this spec would otherwise each hold their
// own copy of the namespace, so jest.spyOn on one wouldn't affect the other.
// Replacing the module outright gives both the same mocked functions.
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwtService: { sign: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'amwai@mavenschessclub.com',
    passwordHash: 'hashed-password',
    role: 'ADMIN',
    isCoach: true,
    isActive: true
  };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService }
      ]
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('throws UnauthorizedException when no user exists with that email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login('nobody@example.com', 'whatever')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws UnauthorizedException when the user account is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(authService.login(mockUser.email, 'whatever')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      await expect(authService.login(mockUser.email, 'wrong-password')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('returns an access token and user info when credentials are valid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      const result = await authService.login(mockUser.email, 'correct-password');

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        isCoach: mockUser.isCoach
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        isCoach: mockUser.isCoach
      });
    });

    // This tests a SECURITY PROPERTY, not just a happy path: "no user found"
    // and "wrong password" must be indistinguishable to a caller, or an
    // attacker could use the error message to enumerate valid emails.
    it('gives the same error message whether the email or the password was wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      let noUserError: Error | undefined;
      try {
        await authService.login('nobody@example.com', 'x');
      } catch (err) {
        noUserError = err as Error;
      }

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);
      let wrongPasswordError: Error | undefined;
      try {
        await authService.login(mockUser.email, 'wrong');
      } catch (err) {
        wrongPasswordError = err as Error;
      }

      expect(noUserError?.message).toBe(wrongPasswordError?.message);
    });
  });
});
