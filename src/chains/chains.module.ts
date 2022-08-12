import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';
import { ChainsController } from './chains.controller';
import { SafeConfigModule } from '../services/safe-config/safe-config.module';

@Module({
  imports: [SafeConfigModule],
  controllers: [ChainsController],
  providers: [ChainsService],
})
export class ChainsModule {}
