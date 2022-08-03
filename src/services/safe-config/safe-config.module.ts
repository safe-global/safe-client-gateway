import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SafeConfigService } from './safe-config.service';

@Module({
  imports: [HttpModule],
  providers: [SafeConfigService],
  exports: [SafeConfigService],
})
export class SafeConfigModule {}
