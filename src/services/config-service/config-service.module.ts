import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ConfigService } from './config-service.service';

@Module({
  providers: [ConfigService, HttpErrorHandler],
  exports: [ConfigService],
})
export class ConfigServiceModule {}
