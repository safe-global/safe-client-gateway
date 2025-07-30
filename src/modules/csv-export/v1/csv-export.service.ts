import { IConfigurationService } from '@/config/configuration.service.interface';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import { CsvExportJobData } from '@/modules/csv-export/v1/entities/csv-export-job-data.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

import { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import {
  TransactionExport,
  TransactionExportPageSchema,
} from '@/modules/csv-export/v1/entities/transaction-export.entity';
import { Inject, Injectable } from '@nestjs/common';
import { PassThrough } from 'stream';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Job, UnrecoverableError } from 'bullmq';
import { JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { FileStorageType } from '@/config/entities/schemas/configuration.schema';
import { asError } from '@/logging/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';

@Injectable()
export class CsvExportService {
  private readonly signedUrlTtlSeconds: number;
  private readonly storageType: FileStorageType;
  private readonly localBaseDir: string;

  private static readonly CONTENT_TYPE = 'text/csv';
  private static readonly CSV_OPTIONS = {
    cast: {
      date: (value: Date): string => value.toISOString(),
    },
  };

  private static readonly DEFAULT_LIMIT = '100';
  private static readonly DEFAULT_OFFSET = '0';

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
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.signedUrlTtlSeconds = this.configurationService.getOrThrow<number>(
      'csvExport.signedUrlTtlSeconds',
    );
    this.storageType = this.configurationService.getOrThrow<FileStorageType>(
      'csvExport.fileStorage.type',
    );
    this.localBaseDir = this.configurationService.getOrThrow<string>(
      'csvExport.fileStorage.local.baseDir',
    );
  }

  /**
   * Register an export job of transactions data
   * @param args Export parameters including chain ID, safe address, and date range
   * @returns {Promise<Job>} Job-related data: status, progress, payload etc.
   */
  async registerJob(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job<CsvExportJobData>> {
    const data: CsvExportJobData = { ...args, timestamp: Date.now() };
    return this.jobQueueService.addJob(JobType.CSV_EXPORT, data);
  }

  /**
   * Fetch job's data by ID
   * @param jobId Id of the job
   * @returns {Promise<JobStatusResponseDto>} Job-related data or error in case it's not found
   */
  async getExportStatus(jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.jobQueueService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as CsvExportJobData,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
    };
  }

  /**
   * Exports transactions to CSV format and returns a signed URL (or local path) for download
   * @param args Export parameters including chain ID, safe address, and date range
   * @param onProgress Optional callback to report progress (0-100)
   * @returns {Promise<string>} Signed URL for accessing the generated CSV file
   */
  async export(
    args: {
      chainId: string;
      safeAddress: `0x${string}`;
      executionDateGte?: string;
      executionDateLte?: string;
      limit?: number;
      offset?: number;
    },
    onProgress: (percentage: number) => Promise<void> = async () => {},
  ): Promise<string> {
    const {
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    } = args;

    const transactionExports = await this.fetchTransactionExports(
      {
        chainId,
        safeAddress,
        executionDateGte,
        executionDateLte,
        limit,
        offset,
      },
      onProgress,
    );

    const fileName = this.generateFileName(
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
    );
    await this.uploadCsvToStorage(fileName, transactionExports, onProgress);

    const downloadUrl = await this.getFileUrl(fileName);

    await onProgress(100);
    return downloadUrl;
  }

  /**
   * Fetches transaction exports from the API, handling pagination to get all pages
   * @param args Export parameters including chain ID, safe address, and date range
   * @param onProgress Optional callback to report progress (0-100)
   * @returns {Promise<Array<TransactionExport>>} Array of all transaction exports across all pages
   * @throws {NotFoundException} When no data is found for the given parameters
   */
  private async fetchTransactionExports(
    args: {
      chainId: string;
      safeAddress: `0x${string}`;
      executionDateGte?: string;
      executionDateLte?: string;
      limit?: number;
      offset?: number;
    },
    onProgress: (percentage: number) => Promise<void>,
  ): Promise<Array<TransactionExport>> {
    const {
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    } = args;

    const results: Array<TransactionExport> = [];
    let nextUrl: string | null = null;
    let currentLimit = limit;
    let currentOffset = offset;
    let pageCount = 0;

    const api = await this.exportApiManager.getApi(chainId);

    do {
      try {
        const rawPage = await api.export({
          safeAddress,
          executionDateGte,
          executionDateLte,
          limit: currentLimit,
          offset: currentOffset,
        });

        const page = TransactionExportPageSchema.parse(rawPage);
        pageCount++;

        this.loggingService.info({
          type: LogType.TxnExportFetchRequest,
          chainId,
          safeAddress,
          pageCount,
          resultsCount: page.results.length,
          totalCount: page.count,
          hasNext: !!page.next,
        });

        results.push(...page.results);
        nextUrl = page.next;

        await this.reportProgress(onProgress, results.length, page.count);

        // For subsequent requests, parse the next URL to get new offset/limit
        if (nextUrl) {
          const url = new URL(nextUrl);
          currentLimit = parseInt(
            url.searchParams.get('limit') || CsvExportService.DEFAULT_LIMIT,
          );
          currentOffset = parseInt(
            url.searchParams.get('offset') || CsvExportService.DEFAULT_OFFSET,
          );
        }
      } catch (error) {
        this.loggingService.error({
          type: LogType.TxnExportFetchRequestError,
          chainId,
          safeAddress,
          pageCount: pageCount + 1,
          error: asError(error),
        });
        if (error instanceof DataSourceError && error.code === 404) {
          // move the job to failed without retries (Bullmq-specific error)
          throw new UnrecoverableError('Transactions not found.');
        }
        throw error;
      }
    } while (nextUrl);

    this.loggingService.info({
      type: LogType.TxnExportFetchRequest,
      event: `All pages (${pageCount}) have been succesfully fetched`,
    });

    return results;
  }

  private async uploadCsvToStorage(
    fileName: string,
    results: Array<TransactionExport>,
    onProgress: (percentage: number) => Promise<void>,
  ): Promise<void> {
    const passThrough = new PassThrough();

    const uploadPromise =
      this.storageType === 'aws'
        ? this.cloudStorageApiService.uploadStream(fileName, passThrough, {
            ContentType: CsvExportService.CONTENT_TYPE,
          })
        : this.uploadToLocalStorage(fileName, passThrough);

    await this.csvService.toCsv(
      results,
      passThrough,
      CsvExportService.CSV_OPTIONS,
    );
    await onProgress(80);

    passThrough.end();

    await uploadPromise;
    await onProgress(90);
  }

  private async uploadToLocalStorage(
    fileName: string,
    passThrough: PassThrough,
  ): Promise<void> {
    const writable = fs.createWriteStream(
      path.resolve(this.localBaseDir, fileName),
    );
    return pipeline(passThrough, writable);
  }

  /**
   * Weighted progress:
   *  - Fetching = up to 60%
   */
  private async reportProgress(
    onProgress: (percentage: number) => Promise<void>,
    currentCount: number,
    totalCount: number | null,
  ): Promise<void> {
    let progress = 10;
    if (totalCount && totalCount > 0) {
      progress = Math.round((currentCount / totalCount) * 60);
    }
    await onProgress(progress);
  }

  //TODO timestamp of creation so the prev arent overriden
  private generateFileName(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
  ): string {
    return `${chainId}_${safeAddress}_${executionDateGte || '-'}_${executionDateLte || '-'}.csv`;
  }

  private async getFileUrl(fileName: string): Promise<string> {
    return this.storageType === 'aws'
      ? await this.cloudStorageApiService.getSignedUrl(
          fileName,
          this.signedUrlTtlSeconds,
        )
      : path.resolve(this.localBaseDir, fileName);
  }
}
