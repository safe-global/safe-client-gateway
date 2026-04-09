// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { DelegatesController } from '@/modules/delegate/routes/delegates.controller';
import { DelegatesService } from '@/modules/delegate/routes/delegates.service';
import { DelegateRepositoryModule } from '@/modules/delegate/domain/delegate.repository.module';

@Module({
  imports: [DelegateRepositoryModule],
  controllers: [DelegatesController],
  providers: [DelegatesService],
})
export class DelegatesModule {}
