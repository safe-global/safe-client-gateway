import { Module } from '@nestjs/common';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsApiModule } from '@/datasources/swaps-api/swaps-api.module';

@Module({
  imports: [SwapsApiModule],
  providers: [SwapsRepository],
  exports: [SwapsRepository],
})
export class SwapsModule {}
