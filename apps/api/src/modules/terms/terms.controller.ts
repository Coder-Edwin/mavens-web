import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TermsService } from './terms.service';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';

@Controller('terms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get()
  @Roles('ADMIN', 'COACH')
  findAll(@Query('status') status?: string) {
    return this.termsService.findAll(status);
  }

  @Get(':id')
  @Roles('ADMIN', 'COACH')
  findOne(@Param('id') id: string) {
    return this.termsService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateTermDto) {
    return this.termsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.termsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.termsService.remove(id);
  }
}
