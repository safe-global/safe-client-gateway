// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ZerionCacheService } from '@/modules/zerion/datasources/zerion-cache.service';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';
import { ZerionRepository } from '@/modules/zerion/domain/zerion.repository';
import { IZerionRepository } from '@/modules/zerion/domain/zerion.repository.interface';

@Module({
  providers: [
    ZerionChainMappingService,
    ZerionRateLimiter,
    ZerionCacheService,
    { provide: IZerionRepository, useClass: ZerionRepository },
  ],
  exports: [
    ZerionChainMappingService,
    ZerionRateLimiter,
    ZerionCacheService,
    IZerionRepository,
  ],
})
export class ZerionModule {}
