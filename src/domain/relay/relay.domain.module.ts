import { Module } from '@nestjs/common';
import { LimitAddressesMapper } from '@/domain/relay/limit-addresses.mapper';
import { RelayRepository } from '@/domain/relay/relay.repository';
import { RelayApiModule } from '@/datasources/relay-api/relay-api.module';
import { RelayDecodersModule } from '@/domain/relay/relay-decoders.module';

@Module({
  imports: [RelayApiModule, RelayDecodersModule],
  providers: [LimitAddressesMapper, RelayRepository],
  exports: [RelayRepository],
})
export class RelayDomainModule {}
