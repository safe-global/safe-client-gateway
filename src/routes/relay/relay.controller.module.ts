import { Module } from '@nestjs/common';
import { RelayDomainModule } from '@/domain/relay/relay.domain.module';
import { RelayService } from '@/routes/relay/relay.service';
import { RelayController } from '@/routes/relay/relay.controller';
import { RelayLegacyController } from '@/routes/relay/relay.legacy.controller';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Module({
  imports: [RelayDomainModule],
  providers: [HttpErrorFactory, RelayService],
  controllers: [RelayController, RelayLegacyController],
})
export class RelayControllerModule {}
