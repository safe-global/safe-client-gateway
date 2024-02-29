import { Module } from '@nestjs/common';
import { OrderValidator } from '@/domain/swaps/order.validator';
import { SwapsRepository } from '@/domain/swaps/swaps.repository';
import { SwapsApiModule } from '@/datasources/cow-swap/swaps-api.module';

@Module({
  imports: [SwapsApiModule],
  providers: [OrderValidator, SwapsRepository],
  exports: [SwapsRepository],
})
export class SwapsModule {}
