import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayoutsService } from './payouts.service';
import { GeneratePayoutDto } from './dto/payout.dto';

@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.payoutsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payoutsService.findOne(id);
  }

  @Get(':id/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payout-run.csv"')
  export(@Param('id') id: string) {
    return this.payoutsService.exportCsv(id);
  }

  @Post('generate')
  generate(@Body() dto: GeneratePayoutDto) {
    return this.payoutsService.generate(dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.payoutsService.approve(id);
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string) {
    return this.payoutsService.markPaid(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payoutsService.remove(id);
  }
}
