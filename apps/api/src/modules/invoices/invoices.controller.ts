import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvoicesService } from './invoices.service';
import {
  GenerateEnrollmentInvoiceDto,
  GenerateSchoolGroupInvoiceDto,
  IssueInvoiceDto,
  RecordInvoicePaymentDto,
  UpdateInvoiceDto
} from './dto/invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('enrollmentId') enrollmentId?: string,
    @Query('schoolGroupId') schoolGroupId?: string
  ) {
    return this.invoicesService.findAll({ status, enrollmentId, schoolGroupId });
  }

  // Declared before ':id' so "export" isn't captured as an id.
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="invoices.csv"')
  export(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.invoicesService.exportCsv({ status, from, to });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post('generate/enrollment')
  generateForEnrollment(@Body() dto: GenerateEnrollmentInvoiceDto) {
    return this.invoicesService.generateForEnrollment(dto);
  }

  @Post('generate/school-group')
  generateForSchoolGroup(@Body() dto: GenerateSchoolGroupInvoiceDto) {
    return this.invoicesService.generateForSchoolGroup(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string, @Body() dto: IssueInvoiceDto) {
    return this.invoicesService.issue(id, dto);
  }

  @Post(':id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordInvoicePaymentDto) {
    return this.invoicesService.recordPayment(id, dto);
  }

  @Post(':id/void')
  voidInvoice(@Param('id') id: string) {
    return this.invoicesService.voidInvoice(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
