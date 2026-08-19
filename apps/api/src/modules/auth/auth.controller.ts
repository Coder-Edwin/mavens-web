import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
}
