// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { DelegatesV2Controller } from '@/modules/delegate/routes/v2/delegates.v2.controller';
import { DelegatesV2Service } from '@/modules/delegate/routes/v2/delegates.v2.service';

@Module({
  imports: [DelegatesV2RepositoryModule],
  controllers: [DelegatesV2Controller],
  providers: [DelegatesV2Service],
})
export class DelegatesV2Module {}
