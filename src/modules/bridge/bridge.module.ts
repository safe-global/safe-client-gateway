import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import { BridgeApiFactory } from '@/modules/bridge/datasources/bridge-api.factory';
import { IBridgeRepository } from '@/modules/bridge/domain/bridge.repository.interface';
import { BridgeRepository } from '@/modules/bridge/domain/bridge.repository';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IBridgeApiFactory, useClass: BridgeApiFactory },
    { provide: IBridgeRepository, useClass: BridgeRepository },
  ],
  exports: [IBridgeApiFactory, IBridgeRepository],
})
export class BridgeModule {}
