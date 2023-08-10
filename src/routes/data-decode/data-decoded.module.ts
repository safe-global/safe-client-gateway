import { Module } from '@nestjs/common';
import { DataDecodedController } from './data-decoded.controller';
import { DataDecodedService } from './data-decoded.service';
import { ReadableDescriptionsMapper } from '../../routes/transactions/mappers/common/readable-descriptions.mapper';

@Module({
  controllers: [DataDecodedController],
  providers: [DataDecodedService, ReadableDescriptionsMapper],
})
export class DataDecodedModule {}
