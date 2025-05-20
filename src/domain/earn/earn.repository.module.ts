import { EarnApiModule } from '@/datasources/earn-api/earn-api.module';
import { EarnRepository } from '@/domain/earn/earn.repository';
import { Module } from '@nestjs/common';

@Module({
  imports: [EarnApiModule],
  providers: [EarnRepository],
  exports: [EarnRepository],
})
export class EarnRepositoryModule {}
