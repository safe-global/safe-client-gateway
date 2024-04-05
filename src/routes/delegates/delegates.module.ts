import { Module } from '@nestjs/common';
import { DelegatesController } from '@/routes/delegates/delegates.controller';
import { DelegatesService } from '@/routes/delegates/delegates.service';
import { DelegateRepositoryModule } from '@/domain/delegate/delegate.repository.interface';

@Module({
  imports: [DelegateRepositoryModule],
  controllers: [DelegatesController],
  providers: [DelegatesService],
})
export class DelegatesModule {}
