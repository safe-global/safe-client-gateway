import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';

@Injectable()
export class OutreachFileProcessor implements OnModuleInit {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(ITargetedMessagingDatasource)
    private readonly datasource: ITargetedMessagingDatasource,
  ) {}

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
    if (!outreach.sourceFile) {
      return this.loggingService.error({
        message: 'Outreach has no source file',
      });
    } else {
      // TODO: (AWS S3 integration / local file system) environment specific
      const filePath = path.resolve('src', '__tests__', outreach.sourceFile);
      const data = await readFile(filePath, 'utf-8');
      const checksum = this.checksumData(data);
      if (checksum !== outreach.sourceFileChecksum) {
        return this.loggingService.error({
          message: `Checksum mismatch for outreach ${outreach.id}`,
          expectedChecksum: outreach.sourceFileChecksum,
          actualChecksum: checksum,
        });
      }
    }

    await this.datasource.markOutreachAsProcessed(outreach);
  }

  private checksumData(dataString: string): string {
    const hash = createHash('sha256');
    hash.update(dataString);
    return hash.digest('hex');
  }
}
