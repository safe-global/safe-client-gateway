export const LoggingService = Symbol('ILoggingService');

export interface ILoggingService {
  info(message: unknown): void;

  debug(message: unknown): void;

  error(message: unknown): void;

  warn(message: unknown): void;
}
