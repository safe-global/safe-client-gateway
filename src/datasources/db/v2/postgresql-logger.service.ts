import { Injectable } from '@nestjs/common';
import { AbstractLogger, type LogLevel, type LogMessage } from 'typeorm';

@Injectable()
export class PostgresqlLogger extends AbstractLogger {
  /**
   * Write log to specific output.
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
    console.log('executing query: ' + query);
  }
}
