import { Module } from '@nestjs/common';
import { LockingController } from '@/routes/locking/locking.controller';
import { LockingService } from '@/routes/locking/locking.service';

@Module({
  controllers: [LockingController],
  providers: [LockingService],
})
export class LockingModule {}
