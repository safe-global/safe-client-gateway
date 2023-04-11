import { Module } from '@nestjs/common';
import { DataDecodedController } from './data-decoded.controller';
import { DataDecodedService } from './data-decoded.service';

@Module({
  controllers: [DataDecodedController],
  providers: [DataDecodedService],
  exports: [DataDecodedService],
})
export class DataDecodedModule {}
