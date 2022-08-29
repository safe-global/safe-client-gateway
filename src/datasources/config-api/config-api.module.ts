import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { ConfigApi } from './config-api.service';

@Module({
  providers: [ConfigApi, HttpErrorFactory],
  exports: [ConfigApi],
})
export class ConfigApiModule {}
