import { Module } from '@nestjs/common';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';

@Module({
  providers: [ZerionChainMappingService, ZerionRateLimiter],
  exports: [ZerionChainMappingService, ZerionRateLimiter],
})
export class ZerionModule {}
