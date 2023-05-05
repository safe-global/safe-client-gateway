export const LoggingService = Symbol('ILoggingService');

export interface ILoggingService {
  info(message: string | unknown): void;

  debug(message: string | unknown): void;

  error(message: string | unknown): void;

  warn(message: string | unknown): void;
}
