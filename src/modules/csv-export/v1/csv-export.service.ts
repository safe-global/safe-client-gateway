// SPDX-License-Identifier: FSL-1.1-MIT
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
import { PassThrough, Readable } from 'stream';
import path from 'path';
import fs from 'fs';
import { UnrecoverableError } from 'bullmq';
import {
  JobStatusDto,
  JobStatusResponseDto,
  toJobStatusDto,
} from '@/modules/csv-export/v1/entities/job-status.dto';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { FileStorageType } from '@/config/entities/schemas/configuration.schema';
import { asError } from '@/logging/utils';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { CSV_OPTIONS } from '@/modules/csv-export/v1/entities/csv-export.options';
import { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import type { Address } from 'viem';

@Injectable()
export class CsvExportService {
  private readonly signedUrlTtlSeconds: number;
  private readonly storageType: FileStorageType;
  private readonly localBaseDir: string;

  private static readonly CONTENT_TYPE = 'text/csv';
  private static readonly FILE_NAME = 'transactions_export';
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly DEFAULT_OFFSET = 0;

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
  async registerExportJob(args: {
    chainId: string;
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobStatusDto> {
    const data: CsvExportJobData = args;
    const job = await this.jobQueueService.addJob(JobType.CSV_EXPORT, data);
    return toJobStatusDto(job);
  }

  /**
   * Fetch the job's data by ID
   * @param jobId Id of the job
   * @returns {Promise<JobStatusResponseDto>} Job-related data or error in case it's not found
   */
  async getExportJobStatus(jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.jobQueueService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return toJobStatusDto(job);
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
      safeAddress: Address;
      timestamp: number;
      executionDateGte?: string;
      executionDateLte?: string;
      limit?: number;
      offset?: number;
    },
    onProgress: (percentage: number) => Promise<void> = async () => {},
  ): Promise<string> {
    const { chainId, safeAddress, timestamp } = args;
    const fileName = this.generateFileName(chainId, safeAddress, timestamp);

    const { uploadStream, uploadPromise } = this.createUploadStream(fileName);
    const dataStream = Readable.from(
      this.transactionPagesGenerator(args, onProgress),
      { objectMode: true, highWaterMark: 16 },
    );

    const pipePromise = this.csvService.toCsv(
      dataStream,
      uploadStream,
      CSV_OPTIONS,
    );

    try {
      await Promise.all([pipePromise, uploadPromise]);
    } catch (error) {
      this.loggingService.error(`CSV upload failed: ${asError(error)}`);
      uploadStream.destroy(error as Error); // ensure the other side unwinds
      throw error;
    }
    await onProgress(90);

    const downloadUrl = await this.getFileUrl(fileName);
    await onProgress(100);

    return downloadUrl;
  }

  private async *transactionPagesGenerator(
    args: {
      chainId: string;
      safeAddress: Address;
      executionDateGte?: string;
      executionDateLte?: string;
      limit?: number;
      offset?: number;
    },
    onProgress: (percentage: number) => Promise<void>,
  ): AsyncGenerator<TransactionExport, void, unknown> {
    const {
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    } = args;

    let nextUrl: string | null = null;
    let currentLimit = limit ?? CsvExportService.DEFAULT_LIMIT;
    let currentOffset = offset ?? CsvExportService.DEFAULT_OFFSET;
    let pageCount = 0;
    let totalProcessed = 0;

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

        this.loggingService.debug({
          type: LogType.TxnExportFetchRequest,
          chainId,
          safeAddress,
          pageCount,
          resultsCount: page.results.length,
          totalCount: page.count,
          hasNext: !!page.next,
        });

        // Yield each record individually
        for (const r of page.results) {
          yield r;
        }

        nextUrl = page.next;
        totalProcessed += page.results.length;
        await this.reportProgress(onProgress, totalProcessed, page.count);

        // Update pagination parameters for next request
        if (nextUrl) {
          const { newLimit, newOffset } = this.updatePaginationParams(
            nextUrl,
            chainId,
            safeAddress,
            pageCount,
            currentLimit,
            currentOffset,
          );
          currentLimit = newLimit;
          currentOffset = newOffset;
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
          throw new UnrecoverableError('Transactions not found.');
        }
        throw error;
      }
    } while (nextUrl);

    this.loggingService.info({
      type: LogType.TxnExportFetchRequest,
      event: `All pages (${pageCount}) have been successfully fetched`,
    });
  }

  private createUploadStream(fileName: string): {
    uploadStream: PassThrough | fs.WriteStream;
    uploadPromise: Promise<CompleteMultipartUploadCommandOutput> | null;
  } {
    if (this.storageType === 'aws') {
      const passThrough = new PassThrough();
      const uploadPromise = this.cloudStorageApiService.createUploadStream(
        fileName,
        passThrough,
        {
          ContentType: CsvExportService.CONTENT_TYPE,
        },
      );
      return { uploadStream: passThrough, uploadPromise };
    }
    return {
      uploadStream: fs.createWriteStream(
        path.resolve(this.localBaseDir, fileName),
      ),
      uploadPromise: null,
    };
  }

  private updatePaginationParams(
    nextUrl: string,
    chainId: string,
    safeAddress: Address,
    pageCount: number,
    currentLimit: number,
    currentOffset: number,
  ): { newLimit: number; newOffset: number } {
    const url = new URL(nextUrl);
    const params = url.searchParams;
    const missing = ['limit', 'offset']
      .filter((p) => !params.get(p))
      .join(', ');

    if (missing)
      this.loggingService.warn({
        type: LogType.TxnExportFetchRequestError,
        chainId,
        safeAddress,
        pageCount,
        message: `nextUrl is missing required parameter(s): ${missing}. URL: ${nextUrl}`,
      });

    const newLimit = Number(params.get('limit') ?? currentLimit);
    const newOffset = Number(params.get('offset') ?? currentOffset + newLimit);

    return { newLimit, newOffset };
  }

  /**
   * Weighted progress:
   *  - Fetching + yielding = up to 70%
   */
  private async reportProgress(
    onProgress: (percentage: number) => Promise<void>,
    currentCount: number,
    totalCount: number | null,
  ): Promise<void> {
    let progress = 10;
    if (totalCount && totalCount > 0) {
      progress = Math.min(70, Math.floor((currentCount / totalCount) * 70));
    }
    await onProgress(progress);
  }

  private generateFileName(
    chainId: string,
    safeAddress: Address,
    timestamp: number,
  ): string {
    return `${CsvExportService.FILE_NAME}_${chainId}_${safeAddress}_${timestamp}.csv`;
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
