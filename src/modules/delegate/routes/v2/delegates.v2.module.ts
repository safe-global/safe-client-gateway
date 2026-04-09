// SPDX-License-Identifier: FSL-1.1-MIT
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.module';
import { DelegatesV2Controller } from '@/modules/delegate/routes/v2/delegates.v2.controller';
import { DelegatesV2Service } from '@/modules/delegate/routes/v2/delegates.v2.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [DelegatesV2RepositoryModule],
  controllers: [DelegatesV2Controller],
  providers: [DelegatesV2Service],
})
export class DelegatesV2Module {}
