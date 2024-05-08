import { Module } from '@nestjs/common';
import { RelayDomainModule } from '@/domain/relay/relay.domain.module';
import { RelayService } from '@/routes/relay/relay.service';
import { RelayController } from '@/routes/relay/relay.controller';

@Module({
  imports: [RelayDomainModule],
  providers: [RelayService],
  controllers: [RelayController],
})
export class RelayControllerModule {}
