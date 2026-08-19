import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/// Delegates to the 'jwt' Passport strategy registered in JwtStrategy.
/// Apply with @UseGuards(JwtAuthGuard) on any controller/route that
/// requires the caller to be logged in.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
