import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { ConfigServiceModule } from '../services/config-service/config-service.module';

@Module({
  imports: [ConfigServiceModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
