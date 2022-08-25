import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ConfigApi } from './config-api.service';

@Module({
  providers: [ConfigApi, HttpErrorHandler],
  exports: [ConfigApi],
})
export class ConfigApiModule {}
