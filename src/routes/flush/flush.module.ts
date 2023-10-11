import { Module } from '@nestjs/common';
import { FlushController } from '@/routes/flush/flush.controller';
import { FlushService } from '@/routes/flush/flush.service';

@Module({
  controllers: [FlushController],
  providers: [FlushService],
})
export class FlushModule {}
