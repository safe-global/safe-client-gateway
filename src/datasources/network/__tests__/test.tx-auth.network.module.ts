import { Module } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { networkService } from '@/datasources/network/__tests__/test.network.module';

/**
 * Test module that overrides {@link TxAuthNetworkModule} with mocked dependencies.
 *
 * Key points:
 * - Reuses the same NetworkService mock instance from {@link TestNetworkModule}
 * - Exports real CacheFirstDataSource & HttpErrorFactory (with mocked NetworkService injected)
 * - Required by TransactionApiManager and other consumers that inject these dependencies
 */
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    {
      provide: NetworkService,
      useFactory: (): jest.MockedObjectDeep<INetworkService> => {
        return jest.mocked(networkService);
      },
    },
    CacheFirstDataSource,
    HttpErrorFactory,
  ],
  exports: [NetworkService, CacheFirstDataSource, HttpErrorFactory],
})
export class TestTxAuthNetworkModule {}
