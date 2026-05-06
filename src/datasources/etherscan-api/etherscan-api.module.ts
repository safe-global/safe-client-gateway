// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { EtherscanApi } from '@/datasources/etherscan-api/etherscan-api.service';
import { IEtherscanApi } from '@/domain/interfaces/etherscan-api.interface';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    HttpErrorFactory,
    { provide: IEtherscanApi, useClass: EtherscanApi },
  ],
  exports: [IEtherscanApi],
})
export class EtherscanApiModule {}
