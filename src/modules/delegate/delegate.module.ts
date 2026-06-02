import { Module } from '@nestjs/common';
import { DelegateRepositoryModule } from '@/modules/delegate/domain/delegate.repository.interface';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { DelegatesV3RepositoryModule } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { DelegatesModule as DelegatesRoutesModule } from '@/modules/delegate/routes/delegates.module';
import { DelegatesV2Module as DelegatesV2RoutesModule } from '@/modules/delegate/routes/v2/delegates.v2.module';
import { DelegatesV3Module as DelegatesV3RoutesModule } from '@/modules/delegate/routes/v3/delegates.v3.module';

@Module({
  imports: [
    DelegateRepositoryModule,
    DelegatesV2RepositoryModule,
    DelegatesV3RepositoryModule,
    DelegatesRoutesModule,
    DelegatesV2RoutesModule,
    DelegatesV3RoutesModule,
  ],
})
export class DelegateModule {}
