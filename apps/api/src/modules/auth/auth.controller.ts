import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/v1/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK) // NestJS defaults POST to 201; a login isn't "creating" anything
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // GET /api/v1/auth/me
  // Any logged-in user — proves JwtAuthGuard alone. No @Roles() needed.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // GET /api/v1/auth/admin-check
  // Admin-only — proves JwtAuthGuard + RolesGuard working together.
  // Note the guard ORDER: JwtAuthGuard must run first to set request.user,
  // otherwise RolesGuard has nothing to check the role against.
  @Get('admin-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  adminCheck(@CurrentUser() user: AuthenticatedUser) {
    return { message: `Welcome, admin ${user.email}. This route is role-protected.` };
  }
}