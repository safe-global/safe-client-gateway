import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { ConfigService } from './config-service.service';

const BASE_URL_PROVIDER = {
  provide: 'SAFE_CONFIG_BASE_URL',
  useValue: 'https://safe-config.gnosis.io', // TODO extract to a config file
};

@Module({
  imports: [HttpModule],
  providers: [ConfigService, BASE_URL_PROVIDER, HttpErrorHandler],
  exports: [ConfigService, BASE_URL_PROVIDER],
})
export class ConfigServiceModule {}
