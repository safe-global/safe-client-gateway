import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { object } from 'zod';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import { Job } from 'bullmq';

//TODO create a separate path in swagger
@ApiTags('export')
@Controller({
  path: '',
  version: '1',
})
export class CsvExportController {
  constructor(private readonly csvExportService: CsvExportService) {}

  @ApiOkResponse({ type: object }) //TODO fix (job-related data)
  @ApiQuery({ name: 'executionDateGte', required: false, type: String })
  @ApiQuery({ name: 'executionDateLte', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Get('chains/:chainId/export/:safeAddress')
  async export(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Query('executionDateGte') executionDateGte?: string, //todo preserve the original format 'execution_date__gte' ? validation ?
    @Query('executionDateLte') executionDateLte?: string, //todo preserve the original format 'execution_date__lte' ?
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ): Promise<Job> {
    const args = {
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    };
    return this.csvExportService.registerJob(args);
  }
}
