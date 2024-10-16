import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { MAX_TTL } from '@/datasources/cache/constants';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';

@Injectable()
export class OutreachFileProcessor implements OnModuleInit {
  constructor(
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
    // TODO: business logic to process outreach
    await this.datasource.markOutreachAsProcessed(outreach);
  }
}
