import { Module } from '@nestjs/common';
import { ValidationModule } from '../../validation.module';
import { DelegatesController } from './delegates.controller';
import { DelegatesService } from './delegates.service';

@Module({
  controllers: [DelegatesController],
  providers: [DelegatesService],
  imports: [ValidationModule],
})
export class DelegatesModule {}
