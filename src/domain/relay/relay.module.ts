import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { RelayDecodersModule } from '@/domain/relay/relay-decoders.module';

@Module({
  providers: [LimitAddressesMapper, RelayDecodersModule],
  exports: [LimitAddressesMapper],
})
export class RelayModule {}
