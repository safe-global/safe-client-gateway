import { Module } from '@nestjs/common';
import { DataDecodedController } from '@/routes/data-decode/data-decoded.controller';
import { DataDecodedService } from '@/routes/data-decode/data-decoded.service';

@Module({
  controllers: [DataDecodedController],
  providers: [DataDecodedService],
})
export class DataDecodedModule {}
