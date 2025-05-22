import { Module } from '@nestjs/common';
import { BridgeApiFactory } from '@/datasources/bridge-api/bridge-api.factory';
import { IBridgeApiFactory } from '@/domain/interfaces/bridge-api.factory.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';

@Module({
  providers: [
    { provide: IBridgeApiFactory, useClass: BridgeApiFactory },
    CacheFirstDataSource,
    HttpErrorFactory,
  ],
  exports: [IBridgeApiFactory],
})
export class BridgeApiModule {}
