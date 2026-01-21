import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import {
  IZerionChainMappingService,
  ZerionChainMappingService,
} from '@/modules/zerion/datasources/zerion-chain-mapping.service';

@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    {
      provide: IZerionChainMappingService,
      useClass: ZerionChainMappingService,
    },
  ],
  exports: [IZerionChainMappingService],
})
export class ZerionModule {}
