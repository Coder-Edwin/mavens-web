import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateCardsService } from './rate-cards.service';
import { CreateRateCardDto, UpdateRateCardDto } from './dto/rate-card.dto';

@Controller('rate-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class RateCardsController {
  constructor(private readonly rateCardsService: RateCardsService) {}

  @Post()
  create(@Body() dto: CreateRateCardDto) {
    return this.rateCardsService.create(dto);
  }

  @Get()
  findAll(@Query('deliveryType') deliveryType?: string, @Query('active') active?: string) {
    return this.rateCardsService.findAll({ deliveryType, active });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rateCardsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRateCardDto) {
    return this.rateCardsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rateCardsService.remove(id);
  }
}
