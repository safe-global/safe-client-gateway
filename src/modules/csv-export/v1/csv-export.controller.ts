import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
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
import { TransactionExportDtoSchema } from '@/modules/csv-export/v1/entities/schemas/transaction-export.dto.schema';
import { TransactionExportDto } from '@/modules/csv-export/v1/entities/transaction-export-request';

@ApiTags('export')
@Controller({
  path: 'export',
  version: '1',
})
export class CsvExportController {
  constructor(private readonly csvExportService: CsvExportService) {}

  @ApiAcceptedResponse({ type: JobStatusDto })
  @ApiBody({
    description: 'Transaction export request',
    type: TransactionExportDto,
    required: false,
  })
  @Post('chains/:chainId/:safeAddress')
  async launchExport(
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
    @Body(new ValidationPipe(TransactionExportDtoSchema))
    exportDto?: TransactionExportDto,
  ): Promise<JobStatusDto> {
    const args = {
      chainId,
      safeAddress,
      ...exportDto,
    };
    return this.csvExportService.registerExportJob(args);
  }

  @ApiOkResponse({
    description: 'CSV export status retrieved successfully',
    type: JobStatusDto,
  })
  @ApiNotFoundResponse({
    description: 'CSV export not found',
    type: JobStatusErrorDto,
  })
  @Get('/:jobId/status')
  async getExportStatus(
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<JobStatusResponseDto> {
    return this.csvExportService.getExportJobStatus(jobId);
  }
}
