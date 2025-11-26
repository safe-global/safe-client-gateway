import { Module } from '@nestjs/common';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SafesModule as SafesRoutesModule } from '@/modules/safe/routes/safes.module';

@Module({
  imports: [SafeRepositoryModule, SafesRoutesModule],
})
export class SafeModule {}
