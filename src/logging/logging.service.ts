import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { ILoggingService } from './logging.interface';
import { Inject } from '@nestjs/common/decorators';
import winston from 'winston';
import { IConfigurationService } from '../config/configuration.service.interface';

/**
 * Implementation of ILoggingService which prepends the current time and a unique request ID to every logged message.
 *
 * The requestID is generated and provided using the `nestjs-cls` `ClsService` which uses the async local storage to store a uuid for each processed request through a middleware.
 */
@Injectable()
export class RequestScopedLoggingService implements ILoggingService {
  private readonly version?: string;
  private readonly buildNumber?: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject('Logger') private readonly logger: winston.Logger,
    private readonly cls: ClsService,
  ) {
    this.version = configurationService.get('about.version');
    this.buildNumber = configurationService.get('about.buildNumber');
  }

  info(message: string | unknown) {
    this.logger.log('info', this.formatMessage(message));
  }

  error(message: string | unknown) {
    this.logger.log('error', this.formatMessage(message));
  }

  warn(message: string | unknown) {
    this.logger.log('warn', this.formatMessage(message));
  }

  debug(message: string | unknown) {
    this.logger.log('debug', this.formatMessage(message));
  }

  private formatMessage(message: string | unknown) {
    const requestId = this.cls.getId();
    const timestamp = Date.now();
    const dateAsString = new Date(timestamp).toISOString();

    return {
      message,
      build_number: this.buildNumber,
      request_id: requestId,
      timestamp: dateAsString,
      version: this.version,
    };
  }
}
