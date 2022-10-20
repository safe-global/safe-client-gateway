import { Module } from '@nestjs/common';
import { DelegatesController } from './delegates.controller';
import { DelegatesService } from './delegates.service';

@Module({
  controllers: [DelegatesController],
  providers: [DelegatesService],
})
export class DelegatesModule {}
