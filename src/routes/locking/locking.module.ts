import { Module } from '@nestjs/common';
import { LockingController } from '@/routes/locking/locking.controller';
import { LockingService } from '@/routes/locking/locking.service';
import { LockingDomainModule } from '@/domain/locking/locking.domain.module';

@Module({
  imports: [LockingDomainModule],
  providers: [LockingService],
  controllers: [LockingController],
})
export class LockingModule {}
