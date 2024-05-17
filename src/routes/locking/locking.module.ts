import { Module } from '@nestjs/common';
import { LockingController } from '@/routes/locking/locking.controller';

@Module({
  controllers: [LockingController],
})
export class LockingModule {}
