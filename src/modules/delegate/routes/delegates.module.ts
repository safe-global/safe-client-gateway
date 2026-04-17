import { Module } from '@nestjs/common';
import { DelegateRepositoryModule } from '@/modules/delegate/domain/delegate.repository.interface';
import { DelegatesController } from '@/modules/delegate/routes/delegates.controller';
import { DelegatesService } from '@/modules/delegate/routes/delegates.service';

@Module({
  imports: [DelegateRepositoryModule],
  controllers: [DelegatesController],
  providers: [DelegatesService],
})
export class DelegatesModule {}
