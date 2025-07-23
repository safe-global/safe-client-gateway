import { IConfigurationService } from '@/config/configuration.service.interface';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { CsvExportJobData } from '@/modules/csv-export/v1/entities/csv-export-job-data.entity';

import { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import {
  TransactionExport,
  TransactionExportPageSchema,
} from '@/modules/csv-export/v1/entities/transaction-export.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PassThrough } from 'stream';
import { Job } from 'bullmq';

@Injectable()
export class CsvExportService {
  private readonly signedUrlTtlSeconds: number;
  private readonly CONTENT_TYPE = 'text/csv';

  //TODO where to put JobQueueShutdownHook ?
  constructor(
    @Inject(IExportApiManager)
    private readonly exportApiManager: IExportApiManager,
    private readonly csvService: CsvService,
    @Inject(IJobQueueService)
    private readonly jobQueueService: IJobQueueService,
    @Inject(ICloudStorageApiService)
    private readonly cloudStorageApiService: ICloudStorageApiService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.signedUrlTtlSeconds = this.configurationService.getOrThrow<number>(
      'csvExport.signedUrlTtlSeconds',
    );
  }

  async registerJob(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job<CsvExportJobData>> {
    const data: CsvExportJobData = { ...args, timestamp: Date.now() };
    //TODO need await here?
    return await this.jobQueueService.addJob(JobType.CSV_EXPORT, data);
  }

  /**
   * Exports transactions to CSV format and returns a signed URL for download
   * @param args Export parameters including chain ID, safe address, and date range
   * @returns Promise<string> Signed URL for accessing the generated CSV file
   */
  async exportTransactions(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executionDateGte: string;
    executionDateLte: string;
    limit?: number;
    offset?: number;
  }): Promise<string> {
    const {
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    } = args;

    // Fetch transaction data from the export API
    // TODO this method needs to be extracted and expanded to fetch multiple pages
    // TODO will be tackled as part of COR-7
    const api = await this.exportApiManager.getApi(chainId);
    const rawPage = await api.export({
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    });

    const page = TransactionExportPageSchema.parse(rawPage);

    if (page.count === 0) {
      throw new NotFoundException('No data found for the given parameters');
    }

    const fileName = this.generateFileName(
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
    );
    await this.uploadCsvToStorage(fileName, page.results);

    return await this.cloudStorageApiService.getSignedUrl(
      fileName,
      this.signedUrlTtlSeconds,
    );
  }

  private generateFileName(
    chainId: string,
    safeAddress: string,
    executionDateGte: string,
    executionDateLte: string,
  ): string {
    return `${chainId}_${safeAddress}_${executionDateGte}_${executionDateLte}.csv`;
  }

  private async uploadCsvToStorage(
    fileName: string,
    results: Array<TransactionExport>,
  ): Promise<void> {
    const passThrough = new PassThrough();

    const uploadPromise = this.cloudStorageApiService.uploadStream(
      fileName,
      passThrough,
      {
        ContentType: this.CONTENT_TYPE,
      },
    );

    await this.csvService.toCsv(results, passThrough);
    passThrough.end();
    await uploadPromise;
  }
}
