import { Module } from '@nestjs/common';
import { RecoveryController } from '@/routes/recovery/recovery.controller';
import { RecoveryService } from '@/routes/recovery/recovery.service';

@Module({
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
