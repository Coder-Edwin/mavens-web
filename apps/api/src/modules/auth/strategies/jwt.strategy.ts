import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
  isCoach: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!
    });
  }

  /// Whatever this returns becomes `request.user` — and therefore what
  /// @CurrentUser() and RolesGuard both see. Kept deliberately small:
  /// no password hash, no extra profile fields, just enough to authorize.
  async validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      isCoach: payload.isCoach
    };
  }
}
