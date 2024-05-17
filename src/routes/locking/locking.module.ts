import { Module } from '@nestjs/common';
import { LockingController } from '@/routes/locking/locking.controller';
import { LockingDomainModule } from '@/domain/locking/locking.domain.module';

@Module({
  imports: [LockingDomainModule],
  controllers: [LockingController],
})
export class LockingModule {}
