import { EarnApiModule } from '@/modules/earn/datasources/earn-api.module';
import { EarnRepository } from '@/modules/earn/domain/earn.repository';
import { Module } from '@nestjs/common';

@Module({
  imports: [EarnApiModule],
  providers: [EarnRepository],
  exports: [EarnRepository],
})
export class EarnRepositoryModule {}
