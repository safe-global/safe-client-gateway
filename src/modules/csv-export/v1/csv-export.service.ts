import { IConfigurationService } from '@/config/configuration.service.interface';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { CsvService } from '@/modules/csv-export/csv-utils/csv.service';
import { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import {
  TransactionExport,
  TransactionExportPageSchema,
} from '@/modules/csv-export/v1/entities/transaction-export.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PassThrough } from 'stream';

@Injectable()
export class CsvExportService {
  private readonly signedUrlTtlSeconds: number;
  private readonly CONTENT_TYPE = 'text/csv';

  constructor(
    @Inject(IExportApiManager)
    private readonly exportApiManager: IExportApiManager,
    private readonly csvService: CsvService,
    @Inject(ICloudStorageApiService)
    private readonly cloudStorageApiService: ICloudStorageApiService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.signedUrlTtlSeconds = this.configurationService.getOrThrow<number>(
      'csvExport.signedUrlTtlSeconds',
    );
  }

  /**
   * Exports transactions data to CSV format and returns a signed URL for download
   * @param args Export parameters including chain ID, safe address, and date range
   * @returns {Promise<string>} Signed URL for accessing the generated CSV file
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

    //------------ This part is temporary and will need to be changed to account for collection of paginated results ---------------
    const api = await this.exportApiManager.getApi(chainId);
    const rawPage = await api.export({
      safeAddress,
      executionDateGte,
      executionDateLte,
      limit,
      offset,
    });

    const { count, results } = TransactionExportPageSchema.parse(rawPage);
    //TODO should we throw an error if no results?
    if (count === 0) {
      throw new NotFoundException('No data found for the given parameters');
    }
    //---------------------------------------------------------------------------------------------------------------------------

    const fileName = this.generateFileName(
      chainId,
      safeAddress,
      executionDateGte,
      executionDateLte,
    );
    await this.uploadCsvToStorage(fileName, results);

    return this.cloudStorageApiService.getSignedUrl(
      fileName,
      this.signedUrlTtlSeconds,
    );
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

  private generateFileName(
    chainId: string,
    safeAddress: string,
    executionDateGte: string,
    executionDateLte: string,
  ): string {
    return `${chainId}_${safeAddress}_${executionDateGte}_${executionDateLte}.csv`;
  }
}
