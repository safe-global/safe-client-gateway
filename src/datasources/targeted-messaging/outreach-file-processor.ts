import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { OutreachFileSchema } from '@/datasources/targeted-messaging/entities/schemas/outreach-file.schema';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

type FileStorageType = 'aws' | 'local';

@Injectable()
export class OutreachFileProcessor implements OnModuleInit {
  private readonly storageType: FileStorageType;
  private readonly localBaseDir: string;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(ITargetedMessagingDatasource)
    private readonly datasource: ITargetedMessagingDatasource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ICloudStorageApiService)
    private readonly cloudStorageApiService: ICloudStorageApiService,
  ) {
    this.storageType = this.configurationService.getOrThrow<FileStorageType>(
      'targetedMessaging.fileStorage.type',
    );
    this.localBaseDir = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.local.baseDir',
    );
  }

  async onModuleInit(): Promise<void> {
    const lockCacheDir = CacheRouter.getOutreachFileProcessorCacheDir();
    try {
      const lock = await this.cacheService.hGet(lockCacheDir);
      if (!lock) {
        await this.cacheService.hSet(lockCacheDir, 'true', MAX_TTL);
        await this.processOutreachFiles();
      }
    } finally {
      await this.cacheService.deleteByKey(lockCacheDir.key);
    }
  }

  private async processOutreachFiles(): Promise<void> {
    const outreaches = await this.datasource.getUnprocessedOutreaches();
    for (const outreach of outreaches) {
      await this.processOutreach(outreach);
    }
  }

  private async processOutreach(outreach: Outreach): Promise<void> {
    try {
      const data = await this.getDataFromFile(outreach);
      const json = JSON.parse(data);
      const outreachData = OutreachFileSchema.parse(json);
      await this.datasource.updateOutreach({
        name: outreachData.campaign_name,
        startDate: outreachData.start_date,
        endDate: outreachData.end_date,
        sourceId: outreachData.campaign_id,
        type: 'new_outreach',
        teamName: outreachData.team_name,
      });
      await this.datasource.createTargetedSafes({
        outreachId: outreach.id,
        addresses: outreachData.safe_addresses,
      });
      await this.datasource.markOutreachAsProcessed(outreach);
    } catch (err) {
      this.loggingService.error(
        `Error parsing Outreach ${outreach.id} data file: ${asError(err).message}`,
      );
    }
  }

  private async getDataFromFile(outreach: Outreach): Promise<string> {
    if (!outreach.sourceFile) {
      throw new Error('No source file');
    }

    const data =
      this.storageType === 'aws'
        ? await this.cloudStorageApiService.getFileContent(outreach.sourceFile)
        : await this.getLocalFileData(outreach.sourceFile);

    const checksum = this.checksumData(data);
    if (checksum !== outreach.sourceFileChecksum) {
      throw new Error(
        `Checksum expected ${outreach.sourceFileChecksum}, but found ${checksum}`,
      );
    }

    return data;
  }

  private async getLocalFileData(sourceFile: string): Promise<string> {
    try {
      return await readFile(
        path.resolve(this.localBaseDir, sourceFile),
        'utf-8',
      );
    } catch (err) {
      throw new Error(
        `Error reading file ${sourceFile}: ${asError(err).message}`,
      );
    }
  }

  private checksumData(dataString: string): string {
    const hash = createHash('sha256');
    hash.update(dataString);
    return hash.digest('hex');
  }
}