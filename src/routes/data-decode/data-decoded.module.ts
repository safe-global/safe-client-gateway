import { Module } from '@nestjs/common';
import { DataDecodedController } from './data-decoded.controller';
import { DataDecodedService } from './data-decoded.service';
import { HumanDescriptionsMapper } from '../../routes/transactions/mappers/common/human-descriptions.mapper';

@Module({
  controllers: [DataDecodedController],
  providers: [DataDecodedService, HumanDescriptionsMapper],
})
export class DataDecodedModule {}
