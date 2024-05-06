import { DelegatesV2RepositoryModule } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { DelegatesV2Controller } from '@/routes/delegates/v2/delegates.v2.controller';
import { DelegatesV2Service } from '@/routes/delegates/v2/delegates.v2.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [DelegatesV2RepositoryModule],
  controllers: [DelegatesV2Controller],
  providers: [DelegatesV2Service],
})
export class DelegatesV2Module {}
