import { Module } from '@nestjs/common';
import { IEtherscanApi } from '@/domain/interfaces/etherscan-api.interface';
import { EtherscanApi } from '@/datasources/etherscan-api/etherscan-api.service';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IEtherscanApi, useClass: EtherscanApi },
  ],
  exports: [IEtherscanApi],
})
export class EtherscanApiModule {}
