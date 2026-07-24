// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ZerionCacheService } from '@/modules/zerion/datasources/zerion-cache.service';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';

@Module({
  providers: [ZerionChainMappingService, ZerionRateLimiter, ZerionCacheService],
  exports: [ZerionChainMappingService, ZerionRateLimiter, ZerionCacheService],
})
export class ZerionModule {}
