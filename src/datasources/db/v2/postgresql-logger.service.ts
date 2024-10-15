import type { ILoggingService } from '@/logging/logging.interface';
import { Injectable } from '@nestjs/common';
import {
  AbstractLogger,
  type LoggerOptions,
  type LogLevel,
  type LogMessage,
} from 'typeorm';

@Injectable()
export class PostgresqlLogger extends AbstractLogger {
  public constructor(
    public options?: LoggerOptions,
    private readonly loggingService?: ILoggingService,
  ) {
    super(options);
  }
  /**
   * Write log to specific output.
   *
   * This is taken from the TypeOrm default implementation, check out {@link https://orkhan.gitbook.io/typeorm/docs/logging}
   */
  protected writeLog(
    level: LogLevel,
    logMessage: LogMessage | LogMessage[],
  ): void {
    const messages = this.prepareLogMessages(logMessage, {
      highlightSql: false,
    });

    for (const message of messages) {
      switch (message.type ?? level) {
        case 'log':
        case 'schema-build':
        case 'migration':
          console.log(message.message);
          break;

        case 'info':
        case 'query':
          if (message.prefix) {
            console.info(message.prefix, message.message);
          } else {
            console.info(message.message);
          }
          break;

        case 'warn':
        case 'query-slow':
          if (message.prefix) {
            console.warn(message.prefix, message.message);
          } else {
            console.warn(message.message);
          }
          break;

        case 'error':
        case 'query-error':
          if (message.prefix) {
            console.error(message.prefix, message.message);
          } else {
            console.error(message.message);
          }
          break;
      }
    }
  }

  /**
   * Logs the executed query along with the request URL if available.
   *
   * @param {string} query - The SQL query string that is being executed.
   *
   * @returns {void} This method does not return anything.
   */
  public logQuery(query: string): void {
    if (this.loggingService) {
      this.loggingService.debug(`executing query: '${query}'`);
    } else {
      console.log({
        message: `executing query: '${query}'`,
        build_number: null,
        request_id: null,
        timestamp: new Date().toISOString(),
        version: null,
      });
    }
  }
}
