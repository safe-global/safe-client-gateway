// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Logger } from 'pino';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import { PinoLogger } from '#/logging/pino-logger.factory';

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
    readonly configurationService: IConfigurationService,
    @Inject(PinoLogger) private readonly logger: Logger,
    private readonly cls: ClsService,
  ) {
    this.version = configurationService.get('about.version');
    this.buildNumber = configurationService.get('about.buildNumber');
  }

  info(message: unknown): void {
    this.logger.info(this.formatMessage(message));
  }

  error(message: unknown): void {
    this.logger.error(this.formatMessage(message));
  }

  warn(message: unknown): void {
    this.logger.warn(this.formatMessage(message));
  }

  debug(message: unknown): void {
    this.logger.debug(this.formatMessage(message));
  }

  private formatMessage(message: unknown): {
    message: unknown;
    build_number: string | undefined;
    request_id: string;
    timestamp: string;
    version: string | undefined;
  } {
    const requestId = this.cls.getId();
    const timestamp = Date.now();
    const dateAsString = new Date(timestamp).toISOString();

    const entry = {
      message,
      build_number: this.buildNumber,
      request_id: requestId,
      timestamp: dateAsString,
      version: this.version,
    };

    if (message instanceof Error) {
      return { ...entry, ...message, message: message.message };
    }

    return entry;
  }
}
