import { Module } from '@nestjs/common';
import { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';

@Module({
  providers: [ZerionChainMappingService],
  exports: [ZerionChainMappingService],
})
export class ZerionModule {}
