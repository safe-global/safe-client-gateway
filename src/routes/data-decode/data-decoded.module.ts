import { Module } from '@nestjs/common';
import { DataDecodedController } from './data-decoded.controller';
import { DataDecodedService } from './data-decoded.service';
import { HumanDescriptionMapper } from '../../routes/transactions/mappers/common/human-description.mapper';

@Module({
  controllers: [DataDecodedController],
  providers: [DataDecodedService, HumanDescriptionMapper],
})
export class DataDecodedModule {}
