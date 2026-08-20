import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MerchandiseItemsService } from './merchandise-items.service';
import { CreateMerchandiseItemDto } from './dto/create-merchandise-item.dto';
import { UpdateMerchandiseItemDto } from './dto/update-merchandise-item.dto';

@Controller('merchandise')
@UseGuards(JwtAuthGuard)
export class MerchandiseItemsController {
  constructor(private readonly merchandiseItemsService: MerchandiseItemsService) {}

  // POST /api/v1/merchandise — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateMerchandiseItemDto) {
    return this.merchandiseItemsService.create(dto);
  }

  // GET /api/v1/merchandise — everyone; admin sees inactive/out-of-stock items too
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.merchandiseItemsService.findAll(user);
  }

  // PATCH /api/v1/merchandise/:id — admin only (price, stock, active flag)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateMerchandiseItemDto) {
    return this.merchandiseItemsService.update(id, dto);
  }
}
