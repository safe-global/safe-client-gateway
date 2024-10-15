import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

@Injectable()
export class OutreachFileProcessor implements OnModuleInit {
  private readonly ttl = 10; // TODO:
  private readonly lockCacheDir = new CacheDir('outreach', 'file-processor'); // TODO:

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(ITargetedMessagingDatasource)
    private readonly datasource: ITargetedMessagingDatasource,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const lock = await this.cacheService.hGet(this.lockCacheDir);
      if (!lock) {
        await this.cacheService.hSet(this.lockCacheDir, 'true', this.ttl);
        await this.processOutreachFiles();
      }
    } finally {
      await this.cacheService.deleteByKey('outreach'); // TODO:
    }
  }

  private async processOutreachFiles(): Promise<void> {
    const outreaches = await this.datasource.getUnprocessedOutreaches();
    console.log(outreaches);
    // TODO: Get outreaches that have not been processed
    // and process their associated files.
  }
}
