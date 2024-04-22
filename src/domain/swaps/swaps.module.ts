import { Module } from '@nestjs/common';
import {
  ISwapsRepository,
  SwapsRepository,
} from '@/domain/swaps/swaps.repository';
import { SwapsApiModule } from '@/datasources/swaps-api/swaps-api.module';

@Module({
  imports: [SwapsApiModule],
  providers: [{ provide: ISwapsRepository, useClass: SwapsRepository }],
  exports: [ISwapsRepository],
})
export class SwapsModule {}
