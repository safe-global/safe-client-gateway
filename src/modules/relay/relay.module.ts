import { Module } from '@nestjs/common';
import { RelayApiModule } from '@/modules/relay/datasources/relay-api.module';
import { RelayDecodersModule } from '@/modules/relay/domain/relay-decoders.module';
import { RelayDomainModule } from '@/modules/relay/domain/relay.domain.module';
import { RelayController } from '@/modules/relay/routes/relay.controller';
import { RelayService } from '@/modules/relay/routes/relay.service';

@Module({
  imports: [RelayApiModule, RelayDecodersModule, RelayDomainModule],
  providers: [RelayService],
  controllers: [RelayController],
})
export class RelayModule {}
