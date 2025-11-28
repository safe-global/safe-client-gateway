import { Module } from '@nestjs/common';
import { DelegateRepositoryModule } from '@/modules/delegate/domain/delegate.repository.interface';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { DelegatesModule as DelegatesRoutesModule } from '@/modules/delegate/routes/delegates.module';
import { DelegatesV2Module as DelegatesV2RoutesModule } from '@/modules/delegate/routes/v2/delegates.v2.module';

@Module({
  imports: [
    DelegateRepositoryModule,
    DelegatesV2RepositoryModule,
    DelegatesRoutesModule,
    DelegatesV2RoutesModule,
  ],
})
export class DelegateModule {}
