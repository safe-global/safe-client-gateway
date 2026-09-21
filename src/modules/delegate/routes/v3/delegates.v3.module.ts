// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { DelegatesV3RepositoryModule } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { DelegatesV3Controller } from '@/modules/delegate/routes/v3/delegates.v3.controller';
import { DelegatesV3Service } from '@/modules/delegate/routes/v3/delegates.v3.service';

@Module({
  imports: [DelegatesV3RepositoryModule],
  controllers: [DelegatesV3Controller],
  providers: [DelegatesV3Service],
})
export class DelegatesV3Module {}
