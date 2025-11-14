import { Module } from '@nestjs/common';
import { RelayDomainModule } from '@/modules/relay/domain/relay.domain.module';
import { RelayService } from '@/modules/relay/routes/relay.service';
import { RelayController } from '@/modules/relay/routes/relay.controller';

@Module({
  imports: [RelayDomainModule],
  providers: [RelayService],
  controllers: [RelayController],
})
export class RelayControllerModule {}
