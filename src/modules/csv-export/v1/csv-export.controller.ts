import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { CsvExportService } from '@/modules/csv-export/v1/csv-export.service';
import {
  JobStatusDto,
  JobStatusErrorDto,
  JobStatusResponseDto,
} from '@/routes/jobs/entities/job-status.dto';

@ApiTags('export')
@Controller({
  path: 'export',
  version: '1',
})
export class CsvExportController {
  constructor(private readonly csvExportService: CsvExportService) {}

  @ApiAcceptedResponse({ type: JobStatusDto })
  @ApiQuery({ name: 'executionDateGte', required: false, type: String })
  @ApiQuery({ name: 'executionDateLte', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Post('chains/:chainId/:safeAddress')
  async export(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Query('executionDateGte') executionDateGte?: string,
    @Query('executionDateLte') executionDateLte?: string,
    @Query('limit', new ParseIntPipe({ optional: true }))
    limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true }))
    offset?: number,
  ): Promise<JobStatusDto> {
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

  @ApiOkResponse({
    description: 'Job status retrieved successfully',
    type: JobStatusDto,
  })
  @ApiNotFoundResponse({
    description: 'CSV export job not found',
    type: JobStatusErrorDto,
  })
  @Get('/:jobId/status')
  async getExportJobStatus(
    @Param('jobId', new ValidationPipe(NumericStringSchema)) jobId: string,
  ): Promise<JobStatusResponseDto> {
    return this.csvExportService.getExportStatus(jobId);
  }
}
